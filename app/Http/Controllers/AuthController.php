<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\PermissionService;
use App\Support\RolePermissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class AuthController extends Controller
{
    public function __construct(
        private PermissionService $permissions,
        private ActivityLogger $activity,
    ) {
    }

    public function showLogin(Request $request): View|\Illuminate\Http\RedirectResponse
    {
        if ($request->session()->has('user')) {
            return redirect('/');
        }

        return view('login', ['title' => 'Login', 'error' => null]);
    }

    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $user = User::with(['department', 'permissions'])->where('username', $validated['username'])->first();

        if (!$user || !password_verify($validated['password'], $user->password)) {
            return response()->json(['error' => 'Invalid username or password'], 401);
        }

        $sessionUser = $this->permissions->sessionPayload($user);

        $request->session()->put('user', $sessionUser);
        $request->session()->put('loginTime', now()->timestamp * 1000);

        return response()->json([
            'success' => true,
            'user' => $sessionUser,
            'sessionMaxAge' => RolePermissions::SESSION_MAX_AGE_MS,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['success' => true]);
    }

    public function session(Request $request): JsonResponse
    {
        $user = $request->session()->get('user');

        if (!$user) {
            return response()->json(['authenticated' => false], 401);
        }

        return response()->json([
            'authenticated' => true,
            'user' => $user,
            'sessionMaxAge' => RolePermissions::SESSION_MAX_AGE_MS,
        ]);
    }

    public function profile(Request $request): JsonResponse
    {
        $sessionUser = $request->session()->get('user');
        $user = User::with('department')->find($sessionUser['id'] ?? 0);

        if (!$user) {
            return response()->json(['error' => 'User not found'], 404);
        }

        return response()->json([
            'id' => $user->id,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'username' => $user->username,
            'birthday' => $user->birthday?->format('Y-m-d'),
            'profile_picture' => $user->profile_picture_url,
            'role' => $user->role,
            'department_name' => $user->department?->name,
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $sessionUser = $request->session()->get('user');
        $user = User::with('department')->find($sessionUser['id'] ?? 0);

        if (!$user) {
            return response()->json(['error' => 'User not found'], 404);
        }

        if ($request->input('birthday') === '') {
            $request->merge(['birthday' => null]);
        }

        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'username' => [
                'required',
                'string',
                'max:100',
                Rule::unique('users', 'username')->ignore($user->id),
            ],
            'birthday' => ['nullable', 'date'],
            'current_password' => ['nullable', 'string'],
            'password' => ['nullable', 'string', 'min:6', 'confirmed'],
            'profile_picture' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp,gif', 'max:2048'],
            'remove_picture' => ['nullable', 'boolean'],
        ]);

        $changingPassword = !empty($data['password']);
        $changedPicture = false;

        if ($changingPassword) {
            if (empty($data['current_password']) || !password_verify($data['current_password'], $user->password)) {
                return response()->json(['error' => 'Current password is incorrect'], 422);
            }
            $user->password = Hash::make($data['password']);
        }

        if ($request->boolean('remove_picture')) {
            $this->deleteProfilePictureFile($user->profile_picture);
            $user->profile_picture = null;
            $changedPicture = true;
        }

        if ($request->hasFile('profile_picture')) {
            $this->deleteProfilePictureFile($user->profile_picture);
            $user->profile_picture = $this->storeProfilePicture($request->file('profile_picture'), (int) $user->id);
            $changedPicture = true;
        }

        $user->first_name = $data['first_name'];
        $user->last_name = $data['last_name'];
        $user->username = $data['username'];
        $user->birthday = $data['birthday'] ?? null;
        $user->save();

        $fresh = $user->fresh(['department', 'permissions']);
        $payload = $this->permissions->sessionPayload($fresh);
        $request->session()->put('user', $payload);

        $details = [];
        if ($changingPassword) {
            $details[] = 'password changed';
        }
        if ($changedPicture) {
            $details[] = $request->boolean('remove_picture') ? 'picture removed' : 'picture updated';
        }

        $this->activity->log(
            $request,
            'updated',
            'Updated their profile'.($details ? ' ('.implode(', ', $details).')' : ''),
            'user',
            (int) $user->id
        );

        return response()->json([
            'success' => true,
            'user' => $payload,
        ]);
    }

    private function storeProfilePicture($file, int $userId): string
    {
        $directory = public_path('uploads/profiles');
        if (!is_dir($directory)) {
            mkdir($directory, 0755, true);
        }

        $filename = 'user_'.$userId.'_'.time().'_'.Str::lower(Str::random(6)).'.'.$file->getClientOriginalExtension();
        $file->move($directory, $filename);

        return $filename;
    }

    private function deleteProfilePictureFile(?string $filename): void
    {
        if (!$filename) {
            return;
        }

        $path = public_path('uploads/profiles/'.$filename);
        if (is_file($path)) {
            @unlink($path);
        }
    }
}
