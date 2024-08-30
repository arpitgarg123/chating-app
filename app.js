const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const app = express();
require('dotenv');
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));
const socketio = require('socket.io');
const http = require('http');
const server = http.createServer(app);
const io = socketio(server);

let userName = [];
let userIds = [];
let userStatus = [];
let userAvatars = [];
let activeChats = {};

io.on("connection", function(socket) {
    socket.on("newUser", function(data) {   
        userName.push(data.name);
        userIds.push(socket.id);
        userAvatars.push(data.avatar);
        userStatus.push("available");
        io.emit("allUsers", { userName, userIds, userStatus, userAvatars});               
    });

    socket.on("startChat", function(friendId){
        const friendIndex = userIds.indexOf(friendId);
        const userIndex = userIds.indexOf(socket.id);
        if (friendIndex !== -1 && userIndex !== -1 && userStatus[userIndex] === "available" && userStatus[friendIndex] === "available") {
            let room = uuidv4();

            if (activeChats[room]) {
                room = activeChats[room];
            } else {
                activeChats[room] = room;
                socket.join(room);
                io.to(friendId).emit("joinRoom", { room, friendAvatar: userAvatars[userIndex], friendName: userName[userIndex] });
                io.to(socket.id).emit("joinRoom", { room, friendAvatar: userAvatars[friendIndex], friendName: userName[friendIndex] });
              
            }

            userStatus[userIndex] = "busy";
            userStatus[friendIndex] = "busy";
            io.emit("allUsers", { userName, userIds, userStatus ,userAvatars});
        }
    });
    socket.on('joinRoom', function(room) {
        socket.join(room);
    });

  socket.on("sendMessage", function(message,room){ 
    const avatar = userAvatars[userIds.indexOf(socket.id)];
    if (activeChats[room] && avatar) {
        io.to(room).emit('message', { message, userId: socket.id, avatar });
    }
  })
  socket.on("signalingMessage", function(data){
      socket.broadcast.to(data.room).emit('signalingMessage', data.message);

  });
  socket.on("startVideoCall", function(room){
socket.broadcast.to(room).emit("incomingCall");
  })
  socket.on("acceptCall", function(room){
    socket.broadcast.to(room).emit("callAccepted");
  })
  socket.on("rejectCall", function(room){
    socket.broadcast.to(room).emit("callRejected");
  })
  socket.on("leaveRoom", function(room) {
    // Find all users in the room
    const usersInRoom = Array.from(io.sockets.adapter.rooms.get(room) || []);

    // Update the status of all users in the room to "available"
    usersInRoom.forEach(userId => {
        const index = userIds.indexOf(userId);
        if (index !== -1) {
            userStatus[index] = "available";
            io.to(userId).emit('leftRoom', room); // Notify the user to leave the room
        }
    });

    // Emit the updated user list
    io.emit("allUsers", { userName, userIds, userStatus });

    // Clean up the room if it exists
    if (activeChats[room]) {
        delete activeChats[room];

        // Make both users leave the room on the server side
        usersInRoom.forEach(userId => {
            const userSocket = io.sockets.sockets.get(userId);
            if (userSocket) {
                userSocket.leave(room);
            }
        });
    }

    // Optionally, handle the case where the user who initiated the leaveRoom request should also be marked as available
    const userIndex = userIds.indexOf(socket.id);
    if (userIndex !== -1) {
        userStatus[userIndex] = "available";
        io.emit("allUsers", { userName, userIds, userStatus,userAvatars});
    }
});
    socket.on("disconnect", function(){
        const index = userIds.indexOf(socket.id);
        if (index !== -1) {
            const room = Object.keys(activeChats).find(r => r.includes(socket.id));

            if (room) {
                const usersInRoom = io.sockets.adapter.rooms.get(room);
                if (usersInRoom) {
                    usersInRoom.forEach(userId => {
                        const idx = userIds.indexOf(userId);
                        if (idx !== -1) {
                            userStatus[idx] = "available";
                        }
                    });
                    io.emit("allUsers", { userName, userIds, userStatus ,userAvatars});
                }
                delete activeChats[room];
                socket.leave(room);
            }

            userName.splice(index, 1);
            userIds.splice(index, 1);
            userStatus.splice(index, 1);
            userAvatars.splice(index, 1);
            io.emit("allUsers", { userName, userIds, userStatus,userAvatars });
        }
    });
});

app.get("/", (req, res) => {
    res.render('index')
});

server.listen(process.env.PORT || 3000);
