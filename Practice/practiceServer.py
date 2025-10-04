import socket #gives all functions and classes needed for network communication (tcp/udp)

HOST = '127.0.0.1'
PORT = 5000

# Create a TCP socket
server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
# it creates a new socket object and assigns it to server_socket
# socket.AF_INET -> address family: IPv4 (AF_INET6 for IPv6)
# socket.SOCK_STREAM -> socket type: TCP (stream-oriented, reliable)......(SOCK_DGRAM for UDP)
# this socket object provides methods like bind(), listen(), accept(), connect(), send(), recv()

server_socket.bind((HOST,PORT))  # bind to IP & PORT
server_socket.listen(1)         # listen for 1 connection
# listen(n) means the socket will allow up to n clients to wait in the queue (backlog) if they try to connect at the same time.
# If the server is busy and 2+ clients try to connect at the same time, the second one may get a “connection refused” error.

print(f"Server listening on {HOST}: {PORT}...")

# accept connection
client_socket, addr = server_socket.accept()
print(f"Connected by {addr}")

data = client_socket.recv(1024).decode()
print(f"Client says: {data}")

client_socket.sendall("Hello Client".encode())

client_socket.close()
server_socket.close()
