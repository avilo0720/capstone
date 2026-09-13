<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\PageController;
use App\Http\Controllers\ItemController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\StockController;
use App\Http\Controllers\TransactionController;
use App\Http\Controllers\ForecastController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\ExportController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\DepartmentController;
use App\Http\Controllers\ActivityLogController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\CalendarNoteController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\ProcurementController;
use App\Http\Controllers\IssuanceController;
use App\Http\Controllers\RealtimeController;

// Auth
Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
Route::post('/api/auth/login', [AuthController::class, 'login']);
Route::post('/api/auth/logout', [AuthController::class, 'logout'])->middleware('auth.custom');
Route::get('/api/auth/session', [AuthController::class, 'session'])->middleware('auth.custom');
Route::get('/api/auth/profile', [AuthController::class, 'profile'])->middleware('auth.custom');
Route::post('/api/auth/profile', [AuthController::class, 'updateProfile'])->middleware('auth.custom');
Route::put('/api/auth/profile', [AuthController::class, 'updateProfile'])->middleware('auth.custom');

// Protected pages
Route::middleware('auth.custom')->group(function () {
    Route::get('/', [PageController::class, 'dashboard']);
    Route::get('/inventory', [PageController::class, 'inventory'])->middleware('page:inventory');
    Route::get('/forecast', [PageController::class, 'forecast'])->middleware('page:forecast');
    Route::get('/procurement', [PageController::class, 'procurement'])->middleware('page:procurement');
    Route::get('/issuance', [PageController::class, 'issuance'])->middleware('page:issuance');
    Route::get('/reports', [PageController::class, 'reports'])->middleware('page:reports');
    Route::get('/calendar', [PageController::class, 'calendar'])->middleware('page:calendar');
    Route::get('/activity-logs', [PageController::class, 'activityLogs'])->middleware('page:activity-logs');
    Route::get('/users', [PageController::class, 'users'])->middleware('page:users');
    Route::get('/procurement-requests/{id}/slip', [ProcurementController::class, 'slip'])->middleware('page:procurement');
});

// Protected API
Route::middleware('auth.custom')->prefix('api')->group(function () {
    // Shared reads used by dashboard/notifications across pages
    Route::get('/items', [ItemController::class, 'index']);
    Route::get('/inventories', [InventoryController::class, 'index']);
    Route::post('/inventories/current', [InventoryController::class, 'select']);
    Route::get('/categories', [CategoryController::class, 'index']);
    Route::get('/forecast-data', [ForecastController::class, 'index']);
    Route::get('/reports/summary', [ReportController::class, 'summary']);
    Route::get('/notifications/alerts', [NotificationController::class, 'alerts']);
    Route::get('/notifications/read', [NotificationController::class, 'readIds']);
    Route::post('/notifications/read', [NotificationController::class, 'markRead']);
    Route::get('/realtime/events', [RealtimeController::class, 'events']);
    Route::get('/activity-logs', [ActivityLogController::class, 'index'])->middleware('page:activity-logs');

    Route::post('/items', [ItemController::class, 'store'])->middleware(['page:inventory', 'ability:inventory.edit']);
    Route::delete('/items/{id}', [ItemController::class, 'destroy'])->middleware(['page:inventory', 'ability:inventory.edit']);

    Route::post('/categories', [CategoryController::class, 'store'])->middleware(['page:inventory', 'ability:inventory.edit']);
    Route::delete('/categories/{id}', [CategoryController::class, 'destroy'])->middleware(['page:inventory', 'ability:inventory.edit']);

    Route::post('/stock', [StockController::class, 'store'])->middleware(['page:inventory', 'ability:inventory.edit']);

    Route::get('/transactions', [TransactionController::class, 'index'])->middleware('page:calendar');
    Route::get('/calendar-notes/options', [CalendarNoteController::class, 'options'])->middleware('page:calendar');
    Route::get('/calendar-notes', [CalendarNoteController::class, 'index'])->middleware('page:calendar');
    Route::post('/calendar-notes', [CalendarNoteController::class, 'store'])->middleware('page:calendar');
    Route::put('/calendar-notes/{id}', [CalendarNoteController::class, 'update'])->middleware('page:calendar');
    Route::delete('/calendar-notes/{id}', [CalendarNoteController::class, 'destroy'])->middleware('page:calendar');

    Route::post('/export/inventory/excel', [ExportController::class, 'inventoryExcel'])->middleware('page:inventory');
    Route::post('/export/inventory/pdf', [ExportController::class, 'inventoryPdf'])->middleware('page:inventory');
    Route::post('/export/inventory/preview', [ExportController::class, 'inventoryPreview'])->middleware('page:inventory');
    Route::post('/export/report/pdf', [ExportController::class, 'reportPdf'])->middleware('page:reports');
    Route::post('/export/report/excel', [ExportController::class, 'reportExcel'])->middleware('page:reports');
    Route::post('/export/report/preview', [ExportController::class, 'reportPreview'])->middleware('page:reports');
    Route::post('/export/forecast/excel', [ExportController::class, 'forecastExcel'])->middleware('page:forecast');
    Route::post('/export/forecast/pdf', [ExportController::class, 'forecastPdf'])->middleware('page:forecast');
    Route::post('/export/forecast/preview', [ExportController::class, 'forecastPreview'])->middleware('page:forecast');
    Route::post('/export/calendar/excel', [ExportController::class, 'calendarExcel'])->middleware('page:calendar');
    Route::post('/export/calendar/pdf', [ExportController::class, 'calendarPdf'])->middleware('page:calendar');
    Route::post('/export/calendar/preview', [ExportController::class, 'calendarPreview'])->middleware('page:calendar');

    Route::middleware('page:procurement')->group(function () {
        Route::get('/procurement-requests', [ProcurementController::class, 'index']);
        Route::get('/procurement-assignees', [ProcurementController::class, 'assignees']);
        Route::get('/procurement-requests/{id}', [ProcurementController::class, 'show']);
        Route::post('/procurement-requests', [ProcurementController::class, 'store'])->middleware('ability:procurement.edit');
        Route::put('/procurement-requests/{id}', [ProcurementController::class, 'update'])->middleware('ability:procurement.edit');
        Route::delete('/procurement-requests/{id}', [ProcurementController::class, 'destroy']);
        Route::post('/procurement-requests/{id}/resubmit', [ProcurementController::class, 'resubmit'])->middleware('ability:procurement.edit');
        Route::post('/procurement-requests/{id}/approve', [ProcurementController::class, 'approve']);
        Route::post('/procurement-requests/{id}/deny', [ProcurementController::class, 'deny']);
        Route::post('/procurement-requests/{id}/stock-entry', [ProcurementController::class, 'stockEntry']);
    });

    Route::middleware('page:issuance')->group(function () {
        Route::get('/issuance-requests', [IssuanceController::class, 'index']);
        Route::get('/issuance-requests/{id}', [IssuanceController::class, 'show']);
        Route::post('/issuance-requests', [IssuanceController::class, 'store'])->middleware('ability:issuance.edit');
        Route::put('/issuance-requests/{id}', [IssuanceController::class, 'update'])->middleware('ability:issuance.edit');
        Route::delete('/issuance-requests/{id}', [IssuanceController::class, 'destroy']);
        Route::post('/issuance-requests/{id}/resubmit', [IssuanceController::class, 'resubmit'])->middleware('ability:issuance.edit');
        Route::post('/issuance-requests/{id}/approve', [IssuanceController::class, 'approve'])->middleware('ability:issuance.review');
        Route::post('/issuance-requests/{id}/deny', [IssuanceController::class, 'deny'])->middleware('ability:issuance.review');
        Route::post('/issuance-requests/{id}/stock-entry', [IssuanceController::class, 'stockEntry'])->middleware('ability:issuance.review');
    });

    Route::middleware(['page:users', 'ability:users.manage'])->group(function () {
        Route::get('/permission-catalog', [UserController::class, 'catalog']);
        Route::get('/users', [UserController::class, 'index']);
        Route::post('/users', [UserController::class, 'store']);
        Route::put('/users/{id}', [UserController::class, 'update']);
        Route::delete('/users/{id}', [UserController::class, 'destroy']);

        Route::get('/departments', [DepartmentController::class, 'index']);
        Route::post('/departments', [DepartmentController::class, 'store']);
        Route::put('/departments/{id}', [DepartmentController::class, 'update']);
        Route::delete('/departments/{id}', [DepartmentController::class, 'destroy']);
    });
});
