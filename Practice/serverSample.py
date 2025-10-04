import socket

HOST = '127.0.0.1'
PORT = 5000

server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
server_socket.bind((HOST, PORT))
server_socket.listen(1)

print(f"Server listening on {HOST}: {PORT}...")

client_socket, addr = server_socket.accept()
print(f"Connecting to {addr}")
data = client_socket.recv(1024).decode()
print(f"Client says: {data}")

client_socket.sendall("Hello Client".encode())

client_socket.close()
server_socket.close()