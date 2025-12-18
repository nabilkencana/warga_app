// src/debug/debug.controller.ts
import { Controller, Get, Res } from '@nestjs/common';
import express from 'express';

@Controller('debug')
export class DebugController {
    @Get('websocket')
    async testWebSocket(@Res() res: express.Response) {
        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>WebSocket Test</title>
    <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
    <style>
        body { font-family: Arial; padding: 20px; }
        #output { 
            background: #f5f5f5; 
            padding: 10px; 
            margin-top: 10px; 
            height: 300px; 
            overflow-y: auto; 
            border: 1px solid #ddd; 
        }
        .success { color: green; }
        .error { color: red; }
        .message { margin: 5px 0; padding: 5px; border-left: 3px solid #007bff; }
    </style>
</head>
<body>
    <h2>WebSocket Connection Test</h2>
    
    <div>
        <label>User ID: </label>
        <input type="number" id="userId" value="1" />
        <button onclick="connect()">Connect</button>
        <button onclick="disconnect()" style="background: #dc3545; color: white;">Disconnect</button>
    </div>
    
    <div>
        <button onclick="sendTestNotification()" style="background: #28a745; color: white; margin-top: 10px;">
            Send Test Notification
        </button>
    </div>
    
    <h3>Connection Status: <span id="status">Disconnected</span></h3>
    <div id="output"></div>
    
    <script>
        let socket = null;
        const output = document.getElementById('output');
        const status = document.getElementById('status');
        
        function log(message, type = 'info') {
            const div = document.createElement('div');
            div.className = 'message ' + type;
            div.innerHTML = '<strong>' + new Date().toLocaleTimeString() + '</strong> - ' + message;
            output.appendChild(div);
            output.scrollTop = output.scrollHeight;
        }
        
        function connect() {
            const userId = document.getElementById('userId').value;
            
            if (socket) {
                socket.disconnect();
            }
            
            log('Connecting to WebSocket server...');
            status.textContent = 'Connecting...';
            status.style.color = 'orange';
            
            // PERHATIAN: Gunakan URL yang benar
            const wsUrl = 'http://localhost:1922';
            
            socket = io(wsUrl + '/notifications', {
                query: { userId: userId },
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: 5,
            });
            
            socket.on('connect', () => {
                log('✅ Connected to WebSocket server', 'success');
                log('Socket ID: ' + socket.id, 'success');
                status.textContent = 'Connected';
                status.style.color = 'green';
            });
            
            socket.on('welcome', (data) => {
                log('👋 Welcome: ' + JSON.stringify(data), 'success');
            });
            
            socket.on('notification', (data) => {
                log('📨 Notification: ' + JSON.stringify(data), 'info');
            });
            
            socket.on('connect_error', (error) => {
                log('❌ Connection Error: ' + error.message, 'error');
                status.textContent = 'Connection Error';
                status.style.color = 'red';
                console.error('Socket error:', error);
            });
            
            socket.on('disconnect', (reason) => {
                log('🔌 Disconnected: ' + reason, 'error');
                status.textContent = 'Disconnected';
                status.style.color = 'red';
            });
        }
        
        function disconnect() {
            if (socket) {
                socket.disconnect();
                log('Manually disconnected', 'error');
                status.textContent = 'Disconnected';
                status.style.color = 'red';
            }
        }
        
        function sendTestNotification() {
            if (!socket || !socket.connected) {
                alert('Please connect first!');
                return;
            }
            
            // Trigger via REST API
            fetch('http://localhost:1922/api/notifications/test/notification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            })
            .then(response => response.json())
            .then(data => {
                log('Test notification triggered: ' + JSON.stringify(data), 'success');
            })
            .catch(error => {
                log('Failed to trigger notification: ' + error, 'error');
            });
        }
        
        // Auto connect on page load
        window.onload = function() {
            setTimeout(connect, 1000);
        };
    </script>
</body>
</html>
    `;

        res.type('html').send(html);
    }
}