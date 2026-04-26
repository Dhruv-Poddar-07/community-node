import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { type User as FirebaseUser } from 'firebase/auth';
import { loginUser, registerUser, logoutUser, onAuthStateChange } from '../services/firebaseAuth';
import { getUserProfile, initializeDefaultChatRooms } from '../services/firestoreService';
import { setDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  role: 'staff' | 'volunteer';
  phone?: string;
}

interface Volunteer {
  id: string;
  userId: string;
  name: string;
  email: string;
  city: string;
  skills: string[];
  specialty?: string;
  availability?: string;
  hoursLogged: number;
  tasksCompleted: number;
  badge: string;
  status: string;
  joinedAt: string;
  averageRating?: number;
}

interface AuthContextType {
  user: User | null;
  volunteer: Volunteer | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
  name: string;
  phone?: string;
  role: 'staff' | 'volunteer';
  city?: string;
  skills?: string[];
  specialty?: string;
  availability?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [volunteer, setVolunteer] = useState<Volunteer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize default chat rooms on app load
    initializeDefaultChatRooms().catch(console.error);
    
    const unsubscribe = onAuthStateChange(async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        try {
          // Get user profile from Firestore
          const userProfile = await getUserProfile(firebaseUser.uid);
          
          if (userProfile) {
            const userData: User = {
              id: firebaseUser.uid,
              username: userProfile.username || firebaseUser.email?.split('@')[0] || '',
              name: userProfile.name,
              email: userProfile.email,
              role: userProfile.role,
              phone: userProfile.phone
            };
            setUser(userData);

            // If volunteer, set volunteer data from users collection
            if (userData.role === 'volunteer') {
              setVolunteer(userProfile as Volunteer);
            }
          }
        } catch (error) {
        }
      } else {
        setUser(null);
        setVolunteer(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      await loginUser(email, password);
      // Auth state change will handle setting user data
    } catch (error) {
      throw error;
    }
  };

  const register = async (userData: RegisterData) => {
    try {
      const firebaseUser = await registerUser(userData.email, userData.password);
      
      // Create combined user profile in Firestore (users collection only)
      const profileData = {
        username: userData.username,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        phone: userData.phone,
        // Add volunteer-specific fields if role is volunteer
        ...(userData.role === 'volunteer' && {
          city: userData.city || 'Mumbai',
          skills: userData.skills || [],
          specialty: userData.specialty || '',
          availability: userData.availability || 'Weekends',
          hoursLogged: 0,
          tasksCompleted: 0,
          badge: 'Newcomer',
          status: 'active',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        })
      };

      // Save to users collection using setDoc directly
      await setDoc(doc(db, 'users', firebaseUser.uid), profileData);
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await logoutUser();
    } catch (error) {
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    volunteer,
    loading,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
