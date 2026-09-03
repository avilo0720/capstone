<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Services\ActivityLogger;
use App\Support\ActivityChangeSet;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    public function __construct(private ActivityLogger $activity)
    {
    }

    public function index(): JsonResponse
    {
        $rows = Category::orderByDesc('updated')->get();

        return response()->json($rows);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'id' => ['required'],
            'title' => ['required', 'string'],
            'description' => ['nullable', 'string'],
        ]);

        $now = now();
        $existing = Category::find($data['id']);

        $after = [
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
        ];
        $labels = ['title' => 'Name', 'description' => 'Description'];

        Category::updateOrCreate(
            ['id' => $data['id']],
            [
                ...$after,
                'updated' => $now,
            ]
        );

        $this->activity->log(
            $request,
            $existing ? 'updated' : 'created',
            ($existing ? 'Updated' : 'Added').' category "'.$data['title'].'"',
            'category',
            (int) $data['id'],
            [
                'changes' => $existing
                    ? ActivityChangeSet::diff([
                        'title' => $existing->title,
                        'description' => $existing->description,
                    ], $after, $labels)
                    : ActivityChangeSet::snapshot($after, $labels),
            ]
        );

        return response()->json(['success' => true]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $category = Category::find($id);
        $title = $category?->title ?? ('#'.$id);

        Category::where('id', $id)->delete();

        $this->activity->log(
            $request,
            'deleted',
            'Deleted category "'.$title.'"',
            'category',
            $id,
            [
                'changes' => ActivityChangeSet::snapshot([
                    'title' => $category?->title,
                    'description' => $category?->description,
                ], ['title' => 'Name', 'description' => 'Description']),
            ]
        );

        return response()->json(['success' => true]);
    }
}
