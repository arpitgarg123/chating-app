const socket = io();
const enterbtn = document.querySelector("#nameForm");
const inputUser = document.querySelector("#username");
const listUser = document.querySelector(".contactList");
const message = document.querySelector(".messageInput");

let room;
const avatarOptions = document.querySelectorAll('.avatar-option');
const avatarInput = document.getElementById('avatarInput');
document.addEventListener('DOMContentLoaded', () => {
    avatarOptions.forEach(option => {
        option.addEventListener('click', () => {
            avatarOptions.forEach(opt => {
                opt.style.border = "2px solid transparent";
            });
            option.style.border = "2px solid #4f46e5";

            avatarInput.value = option.getAttribute('data-avatar');
        });
    });
    });
enterbtn.addEventListener("submit", function(event) {
    event.preventDefault();
     if(inputUser.value.trim() !== "" && avatarInput.value.trim() !== ""){
        socket.emit('newUser', {name :inputUser.value, avatar : avatarInput.value});
        document.querySelector(".overlay").style.display = "none";
        document.querySelector(".main").style.filter = "blur(0)";
     }
});

socket.on("allUsers", function(data){
    var clutter = ""
    data.userName.forEach(function(user,index){
        if(data.userIds[index] !== socket.id){
            clutter += `  
                <li class="flex items-center space-x-4 p-2 hover:bg-gray-200 rounded-lg cursor-pointer" onclick="startChat('${data.userIds[index]}')">
                    <img class="h-10 w-10 rounded-full object-cover" src="${data.userAvatars[index]}" alt="${user}">
                    <div>
                        <h2 class="text-md font-semibold">${user}</h2>
                        <p class="text-xs text-gray-500">${data.userStatus[index]}</p>
                    </div>
                </li>`;
        }
    })
    listUser.innerHTML = clutter;
});

function startChat(selectedUserId) {
    socket.emit('startChat', selectedUserId);
document.querySelector(".chatingArea").style.display = 'flex';
if(window.innerWidth <= 640){
    document.querySelector(".sideBar").style.display = 'none';
}
}

socket.on('joinRoom', function(data) {
    room = data.room;
    socket.emit('joinRoom', room);
    if(window.innerWidth <= 640){
        document.querySelector(".sideBar").style.display = 'none';
    }
    document.querySelector(".chatingArea").style.display = 'flex';
    document.querySelector(".welcomeArea").style.display = 'none';
    document.querySelector(".friendName").innerHTML = "chating with " + data.friendName
    document.querySelector(".friendImage").src = data.friendAvatar
    document.querySelector(".formSubmit").addEventListener("submit", function(event){
        event.preventDefault();
        if(message.value.trim()!== ""){
            socket.emit('sendMessage', message.value,room);
            message.value = "";
        }
    });
});

socket.on('message', function(data) {
    const { message, userId } = data;    
const container = document.querySelector(".container");
if(userId === socket.id){
container.innerHTML += `<div class="flex items-start space-x-4 justify-end">
<div class="bg-blue-500 text-white px-1 py-2 rounded-lg">
<p class="text-sm">${message}</p>
</div>
<img class="h-10 w-10 rounded-full object-cover" src="${data.avatar}" alt="User 2">
            </div>`
}
else{
container.innerHTML += `<div class="flex items-start space-x-4 justify-start">
                <img class="h-10 w-10 rounded-full object-cover" src="${data.avatar}" alt="User 1">
                <div class="bg-gray-200 px-1 py-2 rounded-lg">
                    <p class="text-sm">${message}</p>
                </div>
            </div>`
}
container.scrollTop = container.scrollHeight;
});
// webrtc start 

let remoteStream;
let localStream;
let peerConnection;
let inCall = false;
let rtcSetting = {
    iceServers: [{ urls:'stun:stun.l.google.com:19302' }]
}
const initialize = async () => {
    socket.on('signalingMessage',handleSignalingMessage);
try{
    localStream = await  navigator.mediaDevices.getUserMedia({
        video: true,
         audio: true 
       });
       document.querySelector("#localVideo").srcObject = localStream;
           inCall = true;
           initiateOffer();
}
catch(err){
console.log("Rejected by browser" + err.message);

}

}
const initiateOffer =  async () =>{
  await createPeerConnection();
  try{
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('signalingMessage', {
        room,
        message : JSON.stringify({
            type: "offer",
            offer
        })
    });
  }
  catch(err){
    console.log("Error setting local description" + err.message);
  }
  
}
const createPeerConnection = () =>{
    peerConnection = new RTCPeerConnection(rtcSetting); 
  remoteStream =  new MediaStream();

  document.querySelector("#remoteVideo").srcObject = remoteStream;
  localStream.getTracks().forEach(track =>{
    peerConnection.addTrack(track, localStream);
  })
  peerConnection.ontrack = event => {
    event.streams[0].getTracks().forEach(track =>{
        remoteStream.addTrack(track);
    })
  }
  peerConnection.onicecandidate = event => {
    if(event.candidate){
        socket.emit('signalingMessage', {
                room,
                message : JSON.stringify({
                    type: "candidate",
                    candidate: event.candidate
                })
            });
    }
  }
  peerConnection.onconnectionstatechange = event => {
    if(event.target.connectionState === "connected"){
        console.log("Connected");
    }
  }
}

const handleSignalingMessage = async (message) => {
    const {type,offer,answer,candidate,hangup} = JSON.parse(message);
    if(type === "offer"){handleOffer(offer);}
    if(type === "answer"){handleAnswer(answer);}
    if(type === "candidate" &&  peerConnection){
    try{
      await peerConnection.addIceCandidate(candidate);
    }
    catch(err){
console.log(err.message);

    }
    }
    if(type === "hangup"){     
       hangupCall();
    }
}

const handleOffer = async (offer) => {
    if(peerConnection.signalingState === 'stable'){
        console.log("peerConnection is already in stable state");
        return;
    }
    try{
        await peerConnection.setRemoteDescription(offer);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('signalingMessage', {
            room,
            message : JSON.stringify({
                type: "answer",
                answer
            })
        });
        inCall = true;
    }
    catch(err){
        console.log("Error creating handle offer" + err.message);
    }
}
const handleAnswer = async (answer) =>{
try{
    await peerConnection.setRemoteDescription(answer);
}
catch(err){
    console.log("faild to set Answer" + err.message);
}
}
document.querySelector(".videoCall").addEventListener("click",function(){
    if(room){
        socket.emit('startVideoCall', room);
    }
})
socket.on("incomingCall", function(){
    document.querySelector(".call-popup").style.display = 'flex';
})
socket.on("callAccepted", function(){
    initialize();
    document.querySelector(".video-overlay").style.display = 'flex';

});
socket.on("callRejected", function(){
alert("call Rejected by other user");
});
document.querySelector(".acceptCall").addEventListener('click', function(){
    document.querySelector(".call-popup").style.display = 'none';
    document.querySelector(".video-overlay").style.display = 'flex';
    initialize();
    socket.emit("acceptCall",room);
});

document.querySelector(".declineCall").addEventListener('click', function(){
    document.querySelector(".call-popup").style.display = 'none';
    socket.emit("rejectCall",room);
});
document.querySelector(".hang-up").addEventListener('click', function(){
    hangupCall();
})
function hangupCall(){
    if(peerConnection){
        document.querySelector(".video-overlay").style.display = 'none';
    inCall = false;
    peerConnection.close();
    peerConnection = null;
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
        remoteStream = null;
    }
    socket.emit("signalingMessage",{
        room,
        message : JSON.stringify({
            type: "hangup"
        })
    });
    }
}
document.querySelector(".leaveBtn").addEventListener('click', function(){
    if (room) {
        socket.emit('leaveRoom', room);
    }
})

socket.on('leftRoom', function(leftRoom) {
    if (room === leftRoom) {
        room = null;  
       if(window.innerWidth <= 640){
            document.querySelector(".sideBar").style.display = 'block';
        }

document.querySelector(".chatingArea").style.display = 'none';
        document.querySelector(".container").innerHTML = '';
    }
});
