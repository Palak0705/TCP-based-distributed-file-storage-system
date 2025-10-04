import socket
import threading
import os
import json
import time

HOST = '127.0.0.1'
PORT = 5000
UPLOAD_FOLDER = 'uploads'

BACKUP_SERVERS = [
    ('127.0.0.1', 5001),
    ('127.0.0.1', 5002)
]

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Send file in chunks
def send_file(sock, filepath):
    with open(filepath, 'rb') as f:
        while True:
            chunk = f.read(4096)
            if not chunk:
                break
            sock.sendall(chunk)

# Replicate file to backup servers
def replicate_file(filename):
    for ip, port in BACKUP_SERVERS:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.connect((ip, port))
                s.sendall(f'REPLICATE {filename}\n'.encode())
                send_file(s, os.path.join(UPLOAD_FOLDER, filename))
        except Exception as e:
            print(f"Backup server {ip}:{port} not reachable: {e}")

# Handle each client
def handle_client(client_socket, addr):
    print(f"Connected: {addr}")
    try:
        while True:
            request = client_socket.recv(1024).decode()
            if not request:
                break

            parts = request.strip().split()
            command = parts[0].upper()

            # ---------------- UPLOAD ----------------
            if command == 'UPLOAD':
                filename = parts[1]
                filepath = os.path.join(UPLOAD_FOLDER, filename)
                client_socket.sendall(b'READY')

                with open(filepath, 'wb') as f:
                    while True:
                        data = client_socket.recv(4096)
                        if not data:
                            break
                        f.write(data)

                client_socket.sendall(b'UPLOAD_SUCCESS')
                print(f"File uploaded: {filename}")

                threading.Thread(target=replicate_file, args=(filename,), daemon=True).start()

            # ---------------- LIST ----------------
            elif command == 'LIST':
                files = os.listdir(UPLOAD_FOLDER)
                file_list = []
                for fname in files:
                    fpath = os.path.join(UPLOAD_FOLDER, fname)
                    size = os.path.getsize(fpath)
                    upload_time = time.ctime(os.path.getmtime(fpath))
                    file_list.append({
                        'filename': fname,
                        'size': f"{size / 1024:.2f} KB",
                        'uploadDate': upload_time
                    })
                # Send only JSON string
                client_socket.sendall(json.dumps(file_list).encode())
                client_socket.close()  # close after sending

            # ---------------- DOWNLOAD ----------------
            elif command == 'DOWNLOAD':
                filename = parts[1]
                filepath = os.path.join(UPLOAD_FOLDER, filename)
                if os.path.exists(filepath):
                    client_socket.sendall(b'EXISTS\n')
                    ack = client_socket.recv(1024)
                    send_file(client_socket, filepath)
                else:
                    client_socket.sendall(b'FILE_NOT_FOUND\n')
                client_socket.close()

            # ---------------- EXIT ----------------
            elif command == 'EXIT':
                break

    except Exception as e:
        print(f"Error: {e}")
    finally:
        client_socket.close()
        print(f"Disconnected: {addr}")

# Main server
def main():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.bind((HOST, PORT))
    server.listen(5)
    print(f"Main server listening on {HOST}:{PORT}")

    while True:
        client_socket, addr = server.accept()
        client_thread = threading.Thread(target=handle_client, args=(client_socket, addr), daemon=True)
        client_thread.start()

if __name__ == "__main__":
    main()
