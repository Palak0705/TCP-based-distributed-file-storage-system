import socket
import os

HOST = '127.0.0.1'
PORT = 5000

filename = 'sample.txt'

client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
client_socket.connect((HOST, PORT))

client_socket.sendall(filename.encode())

with open(filename,'rb') as f:
  data = f.read()
  client_socket.sendall(data)

print(f"File uploaded successfully")

client_socket.close()