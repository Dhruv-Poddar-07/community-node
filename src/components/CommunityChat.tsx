import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { useAuth } from '../contexts/AuthContext';
import { 
  sendMessage, 
  getMessages, 
  getAllChatRooms,
  getUsersCount 
} from '../services/firestoreService';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: any;
}

interface ChatRoom {
  id: string;
  name: string;
  description: string;
  createdAt?: any;
}

export default function CommunityChat() {
  const { user } = useAuth();
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [messageInput, setMessageInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [memberCount, setMemberCount] = useState<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const initializeChat = async () => {
      try {
        // Get all chat rooms
        const rooms = await getAllChatRooms();
        const formattedRooms = rooms.map((room: any) => ({
          id: room.id,
          name: room.name || room.id,
          description: room.description || 'Community chat room',
          createdAt: room.createdAt
        }));
        setChatRooms(formattedRooms);
        if (rooms.length > 0 && !selectedRoom) {
          setSelectedRoom(rooms[0].id);
        }

        // Get member count
        const count = await getUsersCount();
        setMemberCount(count);
      } catch (error) {
        console.error('Error initializing chat:', error);
      }
    };

    initializeChat();
  }, []);

  useEffect(() => {
    if (selectedRoom) {
      // Unsubscribe from previous room
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }

      // Subscribe to new room messages
      const unsubscribeMessages = getMessages(selectedRoom, (roomMessages) => {
        setMessages(roomMessages);
        scrollToBottom();
      });

      unsubscribeRef.current = unsubscribeMessages;

      return () => {
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
        }
      };
    }
  }, [selectedRoom]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (messageInput.trim() && user && selectedRoom) {
      try {
        await sendMessage(selectedRoom, user.id, user.name, messageInput);
        setMessageInput('');
      } catch (error) {
        console.error('Error sending message:', error);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const currentRoom = chatRooms.find(room => room.id === selectedRoom);
  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getAvatarColor = (senderName: string) => {
    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 'bg-yellow-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500'];
    const index = senderName.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const getAvatar = (senderName: string) => {
    const words = senderName.split(' ');
    if (words.length >= 2) {
      return words[0][0].toUpperCase() + words[1][0].toUpperCase();
    }
    return senderName.substring(0, 2).toUpperCase();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Chat Rooms Sidebar */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-4">Chat Rooms</h4>
        <div className="space-y-2">
          {chatRooms.map(room => (
            <div
              key={room.id}
              className={`p-3 rounded-lg cursor-pointer transition-colors ${
                selectedRoom === room.id 
                  ? 'bg-green-50 border border-green-200' 
                  : 'hover:bg-gray-50 border border-gray-200'
              }`}
              onClick={() => setSelectedRoom(room.id)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-gray-900">{room.name}</span>
              </div>
              <p className="text-sm text-gray-600">{room.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Messages */}
      <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg flex flex-col">
        <div className="border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-gray-900">{currentRoom?.name}</h4>
              <p className="text-sm text-gray-600">{memberCount} members</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline">Pin</Button>
              <Button size="sm" variant="outline">Archive</Button>
            </div>
          </div>
        </div>

        <div className="flex-1 p-4 overflow-y-auto max-h-96">
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                No messages yet
              </div>
            ) : (
              messages.map(message => (
                <div key={message.id} className={`flex items-start gap-3 ${message.senderId === user?.id ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 ${getAvatarColor(message.senderName)} rounded-full flex items-center justify-center text-white text-sm font-bold`}>
                    {getAvatar(message.senderName)}
                  </div>
                  <div className={`flex-1 max-w-[70%] ${message.senderId === user?.id ? 'text-right' : ''}`}>
                    <div className={`flex items-center gap-2 mb-1 ${message.senderId === user?.id ? 'justify-end' : ''}`}>
                      <span className="font-medium text-gray-900">{message.senderName}</span>
                      <span className="text-xs text-gray-500">{formatTimestamp(message.timestamp)}</span>
                    </div>
                    <div className={`rounded-lg p-3 ${message.senderId === user?.id ? 'bg-green-100 text-green-900' : 'bg-gray-100 text-gray-900'}`}>
                      <p className="text-sm">{message.message}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="border-t border-gray-200 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Type your message..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
            />
            <Button 
              onClick={handleSendMessage}
              className="bg-green-600 hover:bg-green-700 btn-primary-hover btn-touch-feedback"
              disabled={!messageInput.trim()}
            >
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
