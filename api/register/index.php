<?php
// /var/www/html/api/register/index.php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON data']);
    exit;
}

// Validate required fields
$required_fields = ['name', 'email', 'contact_phone', 'company_name'];
foreach ($required_fields as $field) {
    if (empty($input[$field])) {
        http_response_code(400);
        echo json_encode(['error' => "Missing required field: $field"]);
        exit;
    }
}

// Supabase configuration (use environment variables in production)
$supabase_url = 'https://dblepmaqqkudsbmvlqcw.supabase.co';
$supabase_service_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRibGVwbWFxcWt1ZHNibXZscWN3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjQ1NTM5OSwiZXhwIjoyMDcyMDMxMzk5fQ.AZygDU4gC4Ne4M0HJDMZsU2PtGWpnwNzALCwbB7Nkfg';

// Check if user already exists
$phone = $input['contact_phone'];
$check_url = $supabase_url . '/rest/v1/customers?contact_phone=eq.' . urlencode($phone) . '&select=id,name,subscription_status,trial_end_date';

$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL => $check_url,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'apikey: ' . $supabase_service_key,
        'Authorization: Bearer ' . $supabase_service_key,
        'Content-Type: application/json'
    ]
]);

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if ($http_code !== 200) {
    curl_close($ch);
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

$users = json_decode($response, true);
curl_close($ch);

// If user exists, check their status
if (!empty($users)) {
    $user = $users[0];
    
    if ($user['trial_end_date']) {
        $trial_end = new DateTime($user['trial_end_date']);
        $now = new DateTime();
        
        // User has active trial or subscription
        if ($user['subscription_status'] === 'active' || 
            ($user['subscription_status'] === 'trial' && $trial_end > $now)) {
            echo json_encode([
                'status' => 'existing_active',
                'user_name' => $user['name'],
                'message' => 'User already has active account'
            ]);
            exit;
        }
    }
    
    // User exists but inactive
    echo json_encode([
        'status' => 'existing_inactive',
        'user_name' => $user['name'],
        'message' => 'User account is inactive, redirect to payment'
    ]);
    exit;
}

// Create new trial user
$trial_data = [
    'name' => trim($input['name']),
    'email' => trim($input['email']),
    'contact_phone' => trim($input['contact_phone']),
    'company_name' => trim($input['company_name']),
    'subscription_status' => 'trial',
    'subscription_plan' => $input['selected_plan'] ?? 'pro',
    'billing_cycle' => $input['billing_cycle'] ?? 'monthly',
    'trial_start_date' => date('c'),
    'trial_end_date' => date('c', strtotime('+14 days')),
    'monthly_quota' => 1000,
    'used_quota' => 0,
    'registration_source' => 'web',
    'payment_status' => 'trial',
    'created_at' => date('c'),
    'updated_at' => date('c')
];

$create_url = $supabase_url . '/rest/v1/customers';
$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL => $create_url,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($trial_data),
    CURLOPT_HTTPHEADER => [
        'apikey: ' . $supabase_service_key,
        'Authorization: Bearer ' . $supabase_service_key,
        'Content-Type: application/json',
        'Prefer: return=representation'
    ]
]);

$create_response = curl_exec($ch);
$create_http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($create_http_code === 201) {
    echo json_encode([
        'status' => 'new_trial',
        'message' => 'Trial account created successfully',
        'trial_end_date' => $trial_data['trial_end_date']
    ]);
} else {
    error_log("Supabase creation failed: " . $create_response);
    http_response_code(500);
    echo json_encode(['error' => 'Failed to create user account']);
}
?>
