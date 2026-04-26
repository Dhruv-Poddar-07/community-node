import { 
  doc, 
  setDoc,
  getDoc,
  addDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';

// User profile operations
export const createUserProfile = async (userId: string, data: any) => {
  const userRef = doc(db, 'users', userId);
  await setDoc(userRef, {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  });
};

export const getUserProfile = async (userId: string) => {
  const userRef = doc(db, 'users', userId);
  const userSnapshot = await getDoc(userRef);
  return userSnapshot.exists() ? userSnapshot.data() : null;
};

// Volunteer profile operations now use users collection only
// Use getUserProfile() to get volunteer data from users collection

// Needs operations
export const createNeed = async (data: any) => {
  try {
    const needsCollection = collection(db, 'needs');
    
    // Use provided lat/lng coordinates directly from map picker
    const { lat, lng } = data;
    
    const docRef = await addDoc(needsCollection, {
      ...data,
      lat,
      lng,
      status: 'open',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    
    return docRef;
  } catch (error) {
    throw error;
  }
};

export const getOpenNeeds = async () => {
  const needsCollection = collection(db, 'needs');
  const q = query(needsCollection, where('status', '==', 'open'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getNeedsByCity = async (city: string) => {
  const needsCollection = collection(db, 'needs');
  const q = query(needsCollection, where('status', '==', 'open'), where('city', '==', city));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getFilteredNeedsForVolunteer = async (volunteerCity: string, volunteerSkills: string[]) => {
  const needsCollection = collection(db, 'needs');
  const q = query(needsCollection, where('status', '==', 'open'));
  const querySnapshot = await getDocs(q);
  const allNeeds = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
  
  // Filter needs based on city and skills
  return allNeeds.filter(need => {
    // City must match
    if (need.city !== volunteerCity) {
      return false;
    }
    
    // Skills must match OR need is General
    const requiredSkill = need.requiredSkill || need.skill;
    if (requiredSkill === 'General') {
      return true; // General needs show to everyone
    }
    
    return volunteerSkills.includes(requiredSkill);
  });
};

// Assignments operations
export const createAssignment = async (data: any) => {
  const assignmentsCollection = collection(db, 'assignments');
  await addDoc(assignmentsCollection, {
    ...data,
    status: 'pending',
    assignedDate: Timestamp.now()
  });
};

export const getVolunteerAssignments = async (volunteerId: string) => {
  const assignmentsCollection = collection(db, 'assignments');
  const q = query(assignmentsCollection, where('volunteerId', '==', volunteerId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Get all volunteers for dashboard
export const getAllVolunteers = async () => {
  const usersCollection = collection(db, 'users');
  const q = query(usersCollection, where('role', '==', 'volunteer'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Get all needs for dashboard
export const getAllNeeds = async () => {
  const needsCollection = collection(db, 'needs');
  const querySnapshot = await getDocs(needsCollection);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Get all assignments for dashboard
export const getAllAssignments = async () => {
  const assignmentsCollection = collection(db, 'assignments');
  const querySnapshot = await getDocs(assignmentsCollection);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Get recent assignments ordered by date
export const getRecentAssignments = async (limit = 10) => {
  const assignmentsCollection = collection(db, 'assignments');
  const q = query(assignmentsCollection);
  const querySnapshot = await getDocs(q);
  const assignments = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // Fetch volunteer names and need titles from collections
  const assignmentsWithFullInfo = await Promise.all(
    assignments.map(async (assignment: any) => {
      let volunteerInfo = {
        volunteer: 'Unknown',
        volunteerCity: 'Unknown'
      };
      
      let needInfo = {
        needTitle: assignment.needTitle || 'Unknown Need'
      };

      // Fetch volunteer info
      if (assignment.volunteerId) {
        try {
          const userRef = doc(db, 'users', assignment.volunteerId);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            volunteerInfo = {
              volunteer: userData.name || 'Unknown',
              volunteerCity: userData.city || 'Unknown'
            };
          }
        } catch (error) {
        }
      }

      // Fetch need title if missing
      if (!assignment.needTitle && assignment.needId) {
        try {
          const needRef = doc(db, 'needs', assignment.needId);
          const needDoc = await getDoc(needRef);
          if (needDoc.exists()) {
            const needData = needDoc.data();
            needInfo.needTitle = needData.title || 'Unknown Need';
          }
        } catch (error) {
        }
      }

      return {
        ...assignment,
        ...volunteerInfo,
        ...needInfo
      };
    })
  );
  
  // Sort by assignedDate (most recent first)
  return assignmentsWithFullInfo
    .sort((a: any, b: any) => {
      const dateA = a.assignedDate?.toMillis?.() || new Date(a.assignedDate || Date.now()).getTime();
      const dateB = b.assignedDate?.toMillis?.() || new Date(b.assignedDate || Date.now()).getTime();
      return dateB - dateA;
    })
    .slice(0, limit);
};

// Chat operations
export const createChatRoom = async (roomId: string, name: string, description: string) => {
  const chatRoomRef = doc(db, 'chatRooms', roomId);
  await setDoc(chatRoomRef, {
    name,
    description,
    createdAt: Timestamp.now()
  });
  return chatRoomRef;
};

export const getChatRoom = async (roomId: string) => {
  const chatRoomRef = doc(db, 'chatRooms', roomId);
  const chatRoomSnapshot = await getDoc(chatRoomRef);
  return chatRoomSnapshot.exists() ? chatRoomSnapshot.data() : null;
};

export const getAllChatRooms = async () => {
  const chatRoomsCollection = collection(db, 'chatRooms');
  const chatRoomsSnapshot = await getDocs(chatRoomsCollection);
  return chatRoomsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

export const sendMessage = async (roomId: string, senderId: string, senderName: string, message: string) => {
  const messagesCollection = collection(db, 'chatRooms', roomId, 'messages');
  const messageDoc = await addDoc(messagesCollection, {
    senderId,
    senderName,
    message,
    timestamp: Timestamp.now()
  });
  return messageDoc;
};

export const getMessages = (roomId: string, callback: (messages: any[]) => void) => {
  const messagesCollection = collection(db, 'chatRooms', roomId, 'messages');
  const messagesQuery = query(messagesCollection, orderBy('timestamp', 'asc'));
  
  return onSnapshot(messagesQuery, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(messages);
  });
};

export const getUsersCount = async () => {
  const usersCollection = collection(db, 'users');
  const usersSnapshot = await getDocs(usersCollection);
  return usersSnapshot.size;
};

export const initializeDefaultChatRooms = async () => {
  const defaultRooms = [
    {
      id: 'general',
      name: 'General Discussion',
      description: 'Open chat for all volunteers'
    },
    {
      id: 'emergency',
      name: 'Emergency Updates',
      description: 'Critical updates and alerts'
    }
  ];

  for (const room of defaultRooms) {
    const existingRoom = await getChatRoom(room.id);
    if (!existingRoom) {
      await createChatRoom(room.id, room.name, room.description);
    }
  }
};

export const subscribeToChatRooms = (callback: (rooms: any[]) => void) => {
  const chatRoomsCollection = collection(db, 'chatRooms');
  return onSnapshot(chatRoomsCollection, (querySnapshot) => {
    const rooms = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(rooms);
  });
};

// Update user profile
export const updateUserProfile = async (userId: string, data: any) => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    ...data,
    updatedAt: Timestamp.now()
  });
};

// Update volunteer profile
export const updateVolunteerProfile = async (volunteerId: string, data: any) => {
  const volunteerRef = doc(db, 'volunteers', volunteerId);
  await updateDoc(volunteerRef, {
    ...data,
    updatedAt: Timestamp.now()
  });
};

