import socket
import threading
import os

HOST = '127.0.0.1'
PORT = 5002  # Use 5002 for backup2.py
UPLOAD_FOLDER = 'backup2'

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Receive file in chunks
def receive_file(client_socket, filename):
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    with open(filepath, 'wb') as f:
        while True:
            data = client_socket.recv(4096)
            if not data:
                break
            f.write(data)
    print(f"File replicated: {filename}")

def handle_client(client_socket, addr):
    print(f"Connected: {addr}")
    try:
        while True:
            request = client_socket.recv(1024).decode()
            if not request:
                break

            parts = request.strip().split()
            command = parts[0].upper()

            if command == 'REPLICATE':
                filename = parts[1]
                client_socket.sendall(b'READY')
                receive_file(client_socket, filename)

            elif command == 'DELETE':
                filename = parts[1]
                filepath = os.path.join(UPLOAD_FOLDER, filename)
                if os.path.exists(filepath):
                    os.remove(filepath)
                    print(f"Deleted file: {filename}")
                else:
                    print(f"File not found for deletion: {filename}")

            elif command == 'EXIT':
                break

    except Exception as e:
        print(f"Error: {e}")
    finally:
        client_socket.close()
        print(f"Disconnected: {addr}")

        
def main():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.bind((HOST, PORT))
    server.listen(5)
    print(f"Backup server listening on {HOST}:{PORT}")

    while True:
        client_socket, addr = server.accept()
        client_thread = threading.Thread(target=handle_client, args=(client_socket, addr), daemon=True)
        client_thread.start()

if __name__ == "__main__":
    main()
