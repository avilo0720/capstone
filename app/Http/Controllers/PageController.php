<?php

namespace App\Http\Controllers;

use Illuminate\View\View;

class PageController extends Controller
{
    public function dashboard(): View
    {
        return view('index', ['title' => 'Dashboard']);
    }

    public function inventory(): View
    {
        return view('inventory', ['title' => 'Inventory']);
    }

    public function forecast(): View
    {
        return view('forecast', ['title' => 'Forecasting']);
    }

    public function reports(): View
    {
        return view('reports', ['title' => 'Reports']);
    }

    public function calendar(): View
    {
        return view('calendar', ['title' => 'Calendar']);
    }

    public function users(): View
    {
        return view('users', ['title' => 'Users']);
    }

    public function activityLogs(): View
    {
        return view('activity-logs', ['title' => 'Activity Logs']);
    }
}
