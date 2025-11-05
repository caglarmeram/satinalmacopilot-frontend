<?php
header('Content-Type: application/json');
echo json_encode(['ok'=>true,'path'=>$_SERVER['REQUEST_URI'] ?? '/']);
