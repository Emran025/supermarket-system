<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class ZATCAInvoiceController extends Controller
{
    public function index()
    {
        return response()->json([
            'message' => 'ZATCA Invoice Controller'
        ]);
    }
}
