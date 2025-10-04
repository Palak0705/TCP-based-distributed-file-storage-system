import socket

HOST = '127.0.0.1'
PORT = 5000

client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
client_socket.connect((HOST,PORT))

client_socket.sendall("Hello Server".encode())

data = client_socket.recv(1024).decode()

print(f"Server says: {data}")

client_socket.close()