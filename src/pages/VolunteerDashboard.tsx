import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { Button } from '../components/ui/button';
import NotificationUI from '../components/ui/notification';
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, updateDoc, addDoc, Timestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { 
  Home, 
  TrendingUp, 
  User, 
  FileText, 
  Menu,
  ClipboardList
} from 'lucide-react';
import InteractiveMap from '../components/InteractiveMap';

// Print-specific styles and animations
const printStyles = `
@media print {
  /* Hide everything except the report content */
  body * {
    visibility: hidden;
  }
  
  /* Show only the report content */
  .print-report,
  .print-report * {
    visibility: visible;
  }
  
  /* Position report content at top of page */
  .print-report {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    padding: 20px;
  }
  
  /* Remove margins and backgrounds for printing */
  body {
    margin: 0;
    background: white;
  }
  
  /* Ensure text is black for printing */
  .print-report * {
    color: black !important;
  }
  
  /* Hide buttons and interactive elements */
  .print-report button,
  .print-report input,
  .print-report textarea {
    display: none;
  }
  
  /* Show textarea content as text */
  .print-report .print-textarea-content::after {
    content: attr(data-content);
    white-space: pre-wrap;
    display: block;
    font-family: Arial, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    margin: 10px 0;
  }
}

/* Home page animations */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeInScale {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.home-fade-in {
  animation: fadeInUp 0.6s ease-out forwards;
}

.home-card-enter {
  animation: fadeInScale 0.4s ease-out forwards;
}

/* Enhanced hover transitions */
.home-card-hover {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.home-card-hover:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
}

/* Stagger animation delays */
.stagger-1 { animation-delay: 0.1s; }
.stagger-2 { animation-delay: 0.2s; }
.stagger-3 { animation-delay: 0.3s; }
.stagger-4 { animation-delay: 0.4s; }
.stagger-5 { animation-delay: 0.5s; }
.stagger-6 { animation-delay: 0.6s; }

/* Line clamp utility */
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
`;

export default function VolunteerLayout() {
  const { user, volunteer, logout } = useAuth();
  const { addNotification, notifications, removeNotification } = useNotifications();
  const [activeTab, setActiveTab] = useState('home');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [appliedTasks, setAppliedTasks] = useState<number[]>([]);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [showTaskDetails, setShowTaskDetails] = useState(false);
  const [availableNeeds, setAvailableNeeds] = useState<any[]>([]);
  const [volunteerSkills, setVolunteerSkills] = useState<string[]>([]);
  const [myAssignments, setMyAssignments] = useState<any[]>([]);
  const [assignmentNeeds, setAssignmentNeeds] = useState<{[key: string]: any}>({});

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    city: 'Mumbai',
    specialty: '',
    availability: 'Weekends'
  });

  // Inject print styles into document
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = printStyles;
    document.head.appendChild(styleElement);
    
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  // Fetch user profile from Firestore on component mount
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        if (!auth.currentUser) {
          console.log('No authenticated user found');
          return;
        }

        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          console.log('Fetched user profile:', userData);
          
          // Update profile form state
          setProfileForm({
            name: userData.name || user?.name || '',
            phone: userData.phone || user?.phone || '',
            city: userData.city || 'Mumbai',
            specialty: userData.specialty || '',
            availability: userData.availability || 'Weekends'
          });
          
          // Update volunteer skills
          if (userData.skills && Array.isArray(userData.skills)) {
            setVolunteerSkills(userData.skills);
          }
        } else {
          console.log('No user document found, using defaults');
          // Set defaults from auth context
          setProfileForm({
            name: user?.name || '',
            phone: user?.phone || '',
            city: 'Mumbai',
            specialty: '',
            availability: 'Weekends'
          });
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        addNotification('Failed to load profile data', 'error');
      }
    };

    fetchUserProfile();
  }, [user, auth.currentUser]);
  
  // Fetch needs from Firestore (filtered by volunteer capabilities)
  const fetchNeeds = async () => {
    try {
      const needsCollection = collection(db, 'needs');
      
      if (volunteer?.city) {
        // Fetch only tasks that match volunteer's city
        const q = query(needsCollection, where('city', '==', volunteer.city));
        const querySnapshot = await getDocs(q);
        const needsData = querySnapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));
        setAvailableNeeds(needsData);
      } else {
        // Fallback to all needs if volunteer city not available
        const querySnapshot = await getDocs(needsCollection);
        const needsData = querySnapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));
        setAvailableNeeds(needsData);
      }
    } catch (error) {
      console.error('Error fetching needs:', error);
    }
  };


  // Sync volunteer skills from auth context
  useEffect(() => {
    console.log('Volunteer data:', volunteer);
    console.log('Volunteer skills from context:', volunteer?.skills);
    if (volunteer?.skills) {
      setVolunteerSkills(volunteer.skills);
      console.log('Set volunteerSkills to:', volunteer.skills);
    }
  }, [volunteer?.skills]);

  // Debug volunteerSkills state changes
  useEffect(() => {
    console.log('volunteerSkills state updated:', volunteerSkills);
  }, [volunteerSkills]);

  // Fetch need details for assignments
  useEffect(() => {
    const fetchNeedDetails = async () => {
      const uniqueNeedIds = [...new Set(myAssignments.map(a => a.needId).filter(Boolean))];
      
      if (uniqueNeedIds.length === 0) return;

      const needPromises = uniqueNeedIds.map(async (needId) => {
        const needDoc = doc(db, 'needs', needId);
        const needSnapshot = await getDoc(needDoc);
        return {
          needId,
          needData: needSnapshot.exists() ? needSnapshot.data() : null
        };
      });

      const needDetails = await Promise.all(needPromises);
      const needsMap: {[key: string]: any} = {};
      
      needDetails.forEach(({ needId, needData }) => {
        if (needData) {
          needsMap[needId] = needData;
        }
      });

      setAssignmentNeeds(needsMap);
      console.log('📄 Fetched need details for assignments:', needsMap);
    };

    fetchNeedDetails();
  }, [myAssignments]);

  // Fetch volunteer assignments from Firestore with proper auth state handling
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log('🔍 Auth state confirmed. Current user UID:', auth.currentUser?.uid);
        console.log('👤 Auth user object:', user);
        
        const assignmentsCollection = collection(db, 'assignments');
        const q = query(assignmentsCollection, where('volunteerId', '==', auth.currentUser?.uid));
        
        const unsubscribeAssignments = onSnapshot(q, (querySnapshot) => {
          const assignmentsData = querySnapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data() 
          }));
          
          console.log('📋 Assignments fetched:', assignmentsData);
          console.log('📊 Query results:', {
            query: `volunteerId == ${auth.currentUser?.uid}`,
            resultsCount: assignmentsData.length,
            assignments: assignmentsData
          });
          
          setMyAssignments(assignmentsData);
        });
        
        return () => unsubscribeAssignments();
      } else {
        console.log('❌ No authenticated user available');
        setMyAssignments([]);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Fetch volunteer skills from Firestore document
  useEffect(() => {
    if (volunteer?.id) {
      const volunteerDoc = doc(db, 'volunteers', volunteer.id);
      getDoc(volunteerDoc).then((docSnapshot) => {
        if (docSnapshot.exists()) {
          const volunteerData = docSnapshot.data();
          if (volunteerData?.skills && Array.isArray(volunteerData.skills)) {
            setVolunteerSkills(volunteerData.skills);
          }
        }
      }).catch((error) => {
        console.error('Error fetching volunteer skills:', error);
      });
    }
  }, [volunteer?.id]);

  // Initial fetch of needs
  useEffect(() => {
    fetchNeeds();
  }, []);

  // Re-run skill matching when needs are loaded
  useEffect(() => {
    if (availableNeeds.length > 0) {
      console.log('Needs loaded, running skill matching...');
      getSkillMatchedTasks();
    }
  }, [availableNeeds, volunteerSkills]);

  // Calculate real stats from Firestore data
  const getTotalHoursFromAssignments = () => {
    const completedAssignments = myAssignments.filter((a: any) => a.status === 'completed');
    return completedAssignments.reduce((total: number, assignment: any) => {
      // Assuming each assignment has an estimatedHours field or default to 3 hours
      return total + (assignment.estimatedHours || 3);
    }, 0);
  };

  const getCompletedTasksCount = () => {
    return myAssignments.filter((a: any) => a.status === 'completed').length;
  };

  const getVolunteerBadge = () => {
    const completedTasks = getCompletedTasksCount();
    if (completedTasks >= 20) return 'Expert';
    if (completedTasks >= 10) return 'Advanced';
    if (completedTasks >= 5) return 'Intermediate';
    if (completedTasks >= 1) return 'Beginner';
    return 'Newcomer';
  };

  const getAverageRating = () => {
    const completedAssignments = myAssignments.filter((a: any) => a.status === 'completed' && a.rating);
    if (completedAssignments.length === 0) return 'N/A';
    
    const totalRating = completedAssignments.reduce((total: number, assignment: any) => {
      return total + (assignment.rating || 0);
    }, 0);
    
    return (totalRating / completedAssignments.length).toFixed(1);
  };

  const getPeopleHelped = () => {
    const completedTasks = getCompletedTasksCount();
    // Estimate people helped based on completed tasks (more realistic than fixed multiplier)
    return completedTasks * 8; // Average 8 people helped per completed task
  };

  const getCurrentWeekRange = () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
    
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${startOfWeek.toLocaleDateString('en-US', options)}-${endOfWeek.toLocaleDateString('en-US', options)}, ${now.getFullYear()}`;
  };

  const getRecentActivities = () => {
    // Get recent activities from assignments
    const recentAssignments = [...myAssignments]
      .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 3); // Get last 3 activities

    const activities = recentAssignments.map((assignment: any) => {
      const date = new Date(assignment.createdAt || Date.now());
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      let timeAgo = 'Just now';
      if (diffDays === 1) timeAgo = '1 day ago';
      else if (diffDays > 1) timeAgo = `${diffDays} days ago`;
      else if (diffDays === 0) {
        const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
        if (diffHours === 1) timeAgo = '1 hour ago';
        else if (diffHours > 1) timeAgo = `${diffHours} hours ago`;
      }

      return {
        title: assignment.status === 'completed' ? 'Completed assignment' : 'Applied to',
        description: assignment.title || 'Task',
        location: assignment.city || 'Unknown',
        timeAgo
      };
    });

    // Add profile update activity if skills were updated recently
    if (volunteerSkills.length > 0) {
      activities.push({
        title: 'Profile updated',
        description: 'Added new skills',
        location: 'Profile',
        timeAgo: '1 week ago'
      });
    }

    return activities;
  };

  const getImpactTimeline = () => {
    const completedAssignments = myAssignments.filter((a: any) => a.status === 'completed');
    const milestones = [];
    
    // First assignment milestone
    if (completedAssignments.length > 0) {
      const firstAssignment = completedAssignments.reduce((earliest: any, current: any) => 
        new Date(current.createdAt || 0).getTime() < new Date(earliest.createdAt || 0).getTime() ? earliest : current
      );
      
      milestones.push({
        number: 1,
        title: 'First Assignment Completed',
        description: firstAssignment.title || 'Task',
        date: new Date(firstAssignment.createdAt || Date.now()).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        color: 'green'
      });
    }

    // Badge milestone (5 tasks)
    if (getCompletedTasksCount() >= 5) {
      milestones.push({
        number: 5,
        title: 'Contributor Badge Earned',
        description: `${getCompletedTasksCount()} tasks completed`,
        date: new Date().toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        color: 'blue'
      });
    }

    // Hours milestone (25 hours)
    if (getTotalHoursFromAssignments() >= 25) {
      milestones.push({
        number: 25,
        title: '25 Hours Milestone',
        description: 'Dedicated service',
        date: new Date().toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        color: 'purple'
      });
    }

    return milestones;
  };

  const menuItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'tasks', label: 'Tasks', icon: ClipboardList },
    { id: 'impact', label: 'Impact', icon: TrendingUp },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'report', label: 'Report', icon: FileText },
  ];

  const handleLogout = async () => {
    await logout();
  };

  const handleApply = async (taskId: number) => {
    try {
      // Find the task details
      const task = availableNeeds.find(need => need.id === taskId);
      if (!task) {
        addNotification('Task not found', 'error');
        return;
      }

      // Check if user is authenticated
      if (!auth.currentUser) {
        addNotification('Please log in to apply for tasks', 'error');
        return;
      }

      // Create assignment document directly in Firestore
      const assignmentsCollection = collection(db, 'assignments');
      const assignmentData = {
        volunteerId: auth.currentUser.uid,
        volunteerName: user?.name || 'Unknown Volunteer',
        volunteerEmail: user?.email || '',
        needId: task.id,
        needTitle: task.title,
        status: 'pending',
        appliedDate: Timestamp.now(),
        assignedDate: Timestamp.now()
      };

      const docRef = await addDoc(assignmentsCollection, assignmentData);
      console.log('Assignment created with ID:', docRef.id);
      
      // Add to applied tasks list
      setAppliedTasks(prev => [...prev, taskId]);
      
      // Show success notification
      addNotification(`Successfully applied for task: ${task.title}!`, 'success');
      
      // Update task status in local state (remove from available)
      setAvailableNeeds(prev => prev.filter(need => need.id !== taskId));
      
    } catch (error) {
      console.error('Error applying for task:', error);
      addNotification('Failed to apply for task. Please try again.', 'error');
    }
  };

  const handleViewTaskDetails = (task: any) => {
    setSelectedTask(task);
    setShowTaskDetails(true);
  };


  const handleAcceptTask = async (task: any) => {
    try {
      // Check if user is authenticated
      if (!auth.currentUser) {
        addNotification('Please log in to accept tasks', 'error');
        return;
      }

      // Create assignment document directly in Firestore
      const assignmentsCollection = collection(db, 'assignments');
      const assignmentData = {
        volunteerId: auth.currentUser.uid,
        volunteerName: user?.name || 'Unknown Volunteer',
        volunteerEmail: user?.email || '',
        needId: task.id,
        needTitle: task.title,
        status: 'pending',
        appliedDate: Timestamp.now(),
        assignedDate: Timestamp.now()
      };

      const docRef = await addDoc(assignmentsCollection, assignmentData);
      console.log('Assignment created with ID:', docRef.id);
      
      addNotification(`Task "${task.title}" accepted successfully!`, 'success');
      
      setShowTaskDetails(false);
      // Update applied tasks to prevent re-application
      setAppliedTasks(prev => [...prev, task.id]);
    } catch (error) {
      console.error('Error accepting task:', error);
      addNotification('Failed to accept task. Please try again.', 'error');
    }
  };

  
  const handleSaveProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    try {
      // Check if user is authenticated
      if (!auth.currentUser) {
        addNotification('Please log in to save profile', 'error');
        return;
      }

      // Get form data
      const formData = new FormData(e.currentTarget);
      const profileData = {
        name: formData.get('name') as string || profileForm.name,
        phone: formData.get('phone') as string || profileForm.phone,
        city: formData.get('city') as string || profileForm.city,
        specialty: formData.get('specialty') as string || profileForm.specialty,
        availability: formData.get('availability') as string || profileForm.availability,
        skills: volunteerSkills,
        updatedAt: Timestamp.now()
      };

      // Update user document in Firestore
      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userDocRef, profileData);
      
      console.log('Profile updated successfully:', profileData);
      addNotification('Profile updated successfully!', 'success');
      
      // Update local state
      setProfileForm({
        name: profileData.name,
        phone: profileData.phone,
        city: profileData.city,
        specialty: profileData.specialty,
        availability: profileData.availability
      });
      
    } catch (error) {
      console.error('Error saving profile:', error);
      addNotification('Failed to save profile. Please try again.', 'error');
    }
  };

  const handleCancelProfile = () => {
    // Reset form or navigate away
    addNotification('Profile changes cancelled', 'info');
  };

  const handleDownloadPDF = () => {
    // Create a printable version of the weekly report
    const weekRange = getCurrentWeekRange();
    const totalHours = getTotalHoursFromAssignments();
    const completedTasks = getCompletedTasksCount();
    const peopleHelped = getPeopleHelped();
    const activities = getRecentActivities();
    
    // Get the current reflection and goals values from the textareas
    const reflectionTextarea = document.querySelector('textarea[placeholder*="Reflect on your volunteer experience"]') as HTMLTextAreaElement;
    const goalsTextarea = document.querySelector('textarea[placeholder*="Set your goals for the upcoming week"]') as HTMLTextAreaElement;
    
    const reflectionText = reflectionTextarea?.value || 'No reflection provided.';
    const goalsText = goalsTextarea?.value || 'No goals set.';
    
    // Create printable report content
    const printContent = `
      <div class="print-report">
        <h1 style="text-align: center; margin-bottom: 30px;">Weekly Volunteer Report</h1>
        
        <div style="margin-bottom: 30px;">
          <h2>Volunteer Information</h2>
          <p><strong>Name:</strong> ${user?.name || 'Unknown'}</p>
          <p><strong>Week:</strong> ${weekRange}</p>
        </div>
        
        <div style="margin-bottom: 30px;">
          <h2>Summary</h2>
          <p><strong>Total Hours:</strong> ${totalHours}</p>
          <p><strong>Tasks Completed:</strong> ${completedTasks}</p>
          <p><strong>People Helped:</strong> ${peopleHelped}</p>
        </div>
        
        <div style="margin-bottom: 30px;">
          <h2>Activities</h2>
          ${activities.length > 0 ? activities.map(activity => 
            `<p style="margin-bottom: 10px;">• <strong>${activity.title}:</strong> ${activity.description} (${activity.location}) - ${activity.timeAgo}</p>`
          ).join('') : '<p>No activities recorded this week.</p>'}
        </div>
        
        <div style="margin-bottom: 30px;">
          <h2>Reflection</h2>
          <div class="print-textarea-content" data-content="${reflectionText.replace(/"/g, '&quot;')}"></div>
        </div>
        
        <div style="margin-bottom: 30px;">
          <h2>Goals for Next Week</h2>
          <div class="print-textarea-content" data-content="${goalsText.replace(/"/g, '&quot;')}"></div>
        </div>
        
        <div style="margin-top: 50px; text-align: center; color: #666;">
          <p>Generated on ${new Date().toLocaleDateString()}</p>
        </div>
      </div>
    `;
    
    // Create a temporary div to hold the print content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = printContent;
    tempDiv.className = 'print-report';
    document.body.appendChild(tempDiv);
    
    // Trigger print dialog
    window.print();
    
    // Remove the temporary div after printing
    setTimeout(() => {
      document.body.removeChild(tempDiv);
    }, 100);
    
    addNotification('Print dialog opened. Save as PDF to download your report.', 'success');
  };

  // Handle skill changes in profile
  const handleSkillChange = (skill: string, checked: boolean) => {
    const updatedSkills = checked 
      ? [...volunteerSkills, skill]
      : volunteerSkills.filter((s: string) => s !== skill);
    setVolunteerSkills(updatedSkills);
  };

  // Handle marking assignment as complete
  const handleMarkComplete = async (assignmentId: string) => {
    try {
      const assignmentRef = doc(db, 'assignments', assignmentId);
      await updateDoc(assignmentRef, {
        status: 'completed',
        completedAt: new Date()
      });
      addNotification('Assignment marked as complete!', 'success');
    } catch (error) {
      console.error('Error marking assignment as complete:', error);
      addNotification('Failed to mark assignment as complete', 'error');
    }
  };

  // Skill-based task matching function
  const getSkillMatchedTasks = () => {
    return availableNeeds.filter((need: any) => {
      // Only show tasks that are active and match volunteer's city
      const isActive = need.status === 'open';
      const locationMatch = volunteer?.city === need.city;
      
      // Check if volunteer has required skill
      const hasSkill = volunteer?.skills && volunteer.skills.length > 0 && 
        (volunteer.skills.includes(need.requiredSkill) || volunteer.specialty === need.requiredSkill);
      
      // Return only active tasks that match location or skill
      return isActive && (locationMatch || hasSkill);
      
      console.log('No match found for:', need.title);
      return false;
    });
    
    const tasks = availableNeeds.filter((need: any) => {
      // Only show tasks that are active and match volunteer's city
      const isActive = need.status === 'open';
      const locationMatch = volunteer?.city && need.city === volunteer.city;
      
      // Check if volunteer has required skills
      const hasSkill = need.requiredSkill && volunteerSkills.some(skill => 
        skill.toLowerCase().includes(need.requiredSkill.toLowerCase())
      );
      
      return isActive && (locationMatch || hasSkill);
    });
    
    console.log('Final matched tasks:', tasks);
    return tasks;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} sidebar sidebar-animate transition-all duration-300 flex flex-col`}>
        {/* Logo */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">CN</span>
            </div>
            {sidebarOpen && (
              <div>
                <h1 className="text-white font-semibold">Community Node</h1>
                <p className="text-gray-400 text-xs">Volunteer Portal</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full sidebar-item flex items-center space-x-3 ${
                    activeTab === item.id ? 'active' : ''
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {sidebarOpen && <span>{item.label}</span>}
                </button>
              );
            })}
          </div>
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            {sidebarOpen && (
              <div className="flex-1">
                <p className="text-white text-sm font-medium">{user?.name}</p>
                <p className="text-gray-400 text-xs capitalize">{user?.role}</p>
              </div>
            )}
          </div>
          {sidebarOpen && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="w-full mt-3 text-gray-300 hover:text-white"
            >
              Sign out
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <Menu className="w-5 h-5" />
              </Button>
              <h2 className="text-xl font-semibold text-gray-900">
                {menuItems.find(item => item.id === activeTab)?.label || 'Home'}
              </h2>
            </div>
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-500">
                  {new Date().toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </div>
              </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto">
          <main className="p-6 content-fade">
            {activeTab === 'home' && (
              <div className="home-fade-in">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {getGreeting()}, {user?.name}!
                </h3>
                <p className="text-gray-600 mb-6">Welcome back to your volunteer dashboard</p>

              {/* Impact Strip */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white border border-gray-200 rounded-lg p-4 home-card-enter home-card-hover stagger-2 min-h-[100px] flex flex-col justify-center">
                    <h4 className="text-sm font-medium text-gray-600 mb-1 truncate">Hours Logged</h4>
                    <div className="text-2xl font-bold text-gray-900 overflow-hidden">{getTotalHoursFromAssignments()}</div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4 home-card-enter home-card-hover stagger-3 min-h-[100px] flex flex-col justify-center">
                    <h4 className="text-sm font-medium text-gray-600 mb-1 truncate">Active Tasks</h4>
                    <div className="text-2xl font-bold text-blue-600 overflow-hidden">{myAssignments.filter(a => a.status !== 'completed').length}</div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4 home-card-enter home-card-hover stagger-4 min-h-[100px] flex flex-col justify-center">
                    <h4 className="text-sm font-medium text-gray-600 mb-1 truncate">Badge</h4>
                    <div className="text-2xl font-bold text-gray-900 capitalize overflow-hidden">{getVolunteerBadge()}</div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4 home-card-enter home-card-hover stagger-5 min-h-[100px] flex flex-col justify-center">
                    <h4 className="text-sm font-medium text-gray-600 mb-1 truncate">Average Rating</h4>
                    <div className="flex items-center overflow-hidden">
                      <div className="text-2xl font-bold text-gray-900 mr-2 flex-shrink-0">
                        {getAverageRating()}
                      </div>
                      {getAverageRating() && (
                        <div className="flex text-yellow-400 flex-shrink-0">
                          {[...Array(5)].map((_, i) => (
                            <span key={i} className={i < Math.floor(parseFloat(getAverageRating()) || 0) ? 'text-yellow-400' : 'text-gray-300'}>
                              ★
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4 home-card-enter home-card-hover stagger-6 min-h-[100px] flex flex-col justify-center md:col-span-4 lg:col-span-1">
                    <h4 className="text-sm font-medium text-gray-600 mb-1 truncate">People Helped</h4>
                    <div className="text-2xl font-bold text-gray-900 overflow-hidden">{getPeopleHelped()}</div>
                  </div>
                </div>

              {/* Matched Tasks */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 w-full">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Your Matched Tasks</h4>
                <div className="mb-3">
                  <p className="text-sm text-gray-600">
                    Showing tasks that match your skills: 
                    <span className="font-medium text-green-600 break-words">
                      {volunteer?.skills?.join(', ') || 'No skills added yet'}
                    </span>
                  </p>
                </div>
                <div className="space-y-4 w-full">
                  {getSkillMatchedTasks().map((need) => (
                    <div key={need.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors duration-200 w-full">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-2">
                        <h5 className="font-medium text-gray-900 truncate flex-1">{need.title}</h5>
                        <span className={`px-2 py-1 text-xs rounded-full flex-shrink-0 ${
                          need.urgency === 'critical' ? 'bg-red-100 text-red-800' :
                          need.urgency === 'high' ? 'bg-orange-100 text-orange-800' :
                          need.urgency === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {need.urgency}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3 line-clamp-3 overflow-hidden">{need.description}</p>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <span className="text-sm text-gray-500 truncate">Required: {need.requiredSkill}</span>
                        <Button 
                          size="sm" 
                          onClick={() => handleApply(need.id)}
                          disabled={appliedTasks.includes(need.id)}
                          className={appliedTasks.includes(need.id) ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700 flex-shrink-0'}
                        >
                          {appliedTasks.includes(need.id) ? 'Applied' : 'Apply'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 mt-6 w-full">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h4>
                <div className="space-y-3 w-full">
                  {getRecentActivities().map((activity, index) => (
                    <div key={index} className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 border-b border-gray-100 gap-2 w-full">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{activity.title}: {activity.description}</p>
                        <p className="text-xs text-gray-500 truncate">{activity.location}</p>
                      </div>
                      <span className="text-xs text-gray-500 flex-shrink-0">{activity.timeAgo}</span>
                    </div>
                  ))}
                  {getRecentActivities().length === 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 gap-2 w-full">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">No recent activity</p>
                        <p className="text-xs text-gray-500">Start applying for tasks to see your activity here</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tasks' && (
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">My Tasks</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-600 mb-1">Active Tasks</h4>
                  <div className="text-2xl font-bold text-blue-600">{myAssignments.filter(a => a.status !== 'completed').length}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-600 mb-1">Completed This Week</h4>
                  <div className="text-2xl font-bold text-green-600">
                    {myAssignments.filter(a => a.status === 'completed' && 
                      new Date(a.completedAt || Date.now()) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                    ).length}
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-600 mb-1">Total Completed</h4>
                  <div className="text-2xl font-bold text-gray-900">{myAssignments.filter(a => a.status === 'completed').length}</div>
                </div>
              </div>

              <div className="space-y-4">
                {myAssignments.length === 0 ? (
                  <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
                    <p className="text-gray-500">No assignments found. Apply for tasks to see them here.</p>
                  </div>
                ) : (
                  myAssignments.map((assignment) => {
                    const needDetails = assignmentNeeds[assignment.needId];
                    return (
                    <div key={assignment.id} className="bg-white border border-gray-200 rounded-lg p-6 card-animate">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="font-semibold text-gray-900">{assignment.needTitle || needDetails?.title || 'Untitled Task'}</h4>
                          <p className="text-sm text-gray-500">
                            Due: {needDetails?.dueDate ? new Date(needDetails.dueDate).toLocaleDateString() : assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : 'No due date'}
                          </p>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          assignment.status === 'completed' ? 'bg-green-100 text-green-800' :
                          assignment.status === 'active' ? 'bg-blue-100 text-blue-800' :
                          assignment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {assignment.status || 'Unknown'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">
                        {needDetails?.description || assignment.description || 'No description available'}
                      </p>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4">
                          <span className="text-sm text-gray-500">
                            Location: {needDetails?.city || 'Unknown'}
                          </span>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            needDetails?.urgency === 'critical' ? 'bg-red-100 text-red-800' :
                            needDetails?.urgency === 'high' ? 'bg-orange-100 text-orange-800' :
                            needDetails?.urgency === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {needDetails?.urgency || 'Normal'} urgency
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => handleViewTaskDetails(assignment)}>
                          View Details
                        </Button>
                        {assignment.status !== 'completed' && (
                          <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleMarkComplete(assignment.id)}
                          >
                            Mark Complete
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
                )}
              </div>
            </div>
          )}

          {activeTab === 'impact' && (
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">My Impact</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
                  <div className="text-4xl font-bold text-green-600 mb-2">{getTotalHoursFromAssignments()}</div>
                  <p className="text-sm text-gray-600">Hours Logged</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
                  <div className="text-4xl font-bold text-blue-600 mb-2">{getCompletedTasksCount()}</div>
                  <p className="text-sm text-gray-600">Tasks Completed</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
                  <div className="text-4xl font-bold text-purple-600 mb-2">{getPeopleHelped()}</div>
                  <p className="text-sm text-gray-600">People Helped</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
                  <div className="text-4xl font-bold text-orange-600 mb-2">{getAverageRating()}</div>
                  <p className="text-sm text-gray-600">Average Rating</p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                <h4 className="font-semibold text-gray-900 mb-4">Impact Timeline</h4>
                <div className="space-y-4">
                  {getImpactTimeline().map((milestone, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <div className={`w-12 h-12 bg-${milestone.color}-100 rounded-full flex items-center justify-center`}>
                        <span className={`text-${milestone.color}-600 font-bold`}>{milestone.number}</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{milestone.title}</p>
                        <p className="text-sm text-gray-500">{milestone.date} - {milestone.description}</p>
                      </div>
                    </div>
                  ))}
                  {getImpactTimeline().length === 0 && (
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                        <span className="text-gray-600 font-bold">0</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">No milestones yet</p>
                        <p className="text-sm text-gray-500">Complete assignments to earn milestones</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="font-semibold text-gray-900 mb-4">Skills Utilized</h4>
                <div className="flex flex-wrap gap-2">
                  {volunteerSkills.length > 0 ? (
                    volunteerSkills.map((skill) => (
                      <span key={skill} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">{skill}</span>
                    ))
                  ) : (
                    <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">No skills added yet</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Edit Profile</h3>
              
              <form onSubmit={handleSaveProfile}>
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                    <input
                      type="text"
                      name="name"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                    <input
                      type="tel"
                      name="phone"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                    <select 
                      name="city"
                      value={profileForm.city}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, city: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="Mumbai">Mumbai</option>
                      <option value="Delhi">Delhi</option>
                      <option value="Bangalore">Bangalore</option>
                      <option value="Chennai">Chennai</option>
                      <option value="Kolkata">Kolkata</option>
                      <option value="Hyderabad">Hyderabad</option>
                      <option value="Pune">Pune</option>
                      <option value="Jaipur">Jaipur</option>
                      <option value="Lucknow">Lucknow</option>
                      <option value="Patna">Patna</option>
                      <option value="Kochi">Kochi</option>
                      <option value="Ahmedabad">Ahmedabad</option>
                      <option value="Surat">Surat</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Specialty</label>
                    <input
                      type="text"
                      name="specialty"
                      value={profileForm.specialty}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, specialty: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
                    <input
                      type="text"
                      name="availability"
                      value={profileForm.availability}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, availability: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Skills</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {['Teaching', 'First Aid', 'Medical', 'Engineering', 'Legal Aid', 'Tree Plantation', 'Elder Care', 'Tutoring', 'Digital Literacy', 'Sports Coaching', 'General'].map(skill => (
                        <label key={skill} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={volunteerSkills.includes(skill)}
                            onChange={(e) => handleSkillChange(skill, e.target.checked)}
                            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                          <span className="text-sm">{skill}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex gap-2">
                  <Button type="submit" className="bg-green-600 hover:bg-green-700">Save Changes</Button>
                  <Button type="button" variant="outline" onClick={handleCancelProfile}>Cancel</Button>
                </div>
              </div>
              </form>
            </div>
          )}

          {activeTab === 'report' && (
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Weekly Report</h3>
              
              <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-semibold text-gray-900">Week of {getCurrentWeekRange()}</h4>
                  <Button className="bg-green-600 hover:bg-green-700" onClick={handleDownloadPDF}>Download PDF</Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <h5 className="font-medium text-gray-900 mb-3">Summary</h5>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Hours:</span>
                        <span className="font-medium">{getTotalHoursFromAssignments()} hours</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tasks Completed:</span>
                        <span className="font-medium">{getCompletedTasksCount()} tasks</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">People Helped:</span>
                        <span className="font-medium">{getPeopleHelped()} people</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h5 className="font-medium text-gray-900 mb-3">Activities</h5>
                    <ul className="space-y-1 text-sm text-gray-600">
                      {myAssignments.filter((a: any) => a.status === 'completed').slice(0, 5).map((assignment: any) => (
                        <li key={assignment.id}>
                          Completed {assignment.title || 'Task'} ({assignment.estimatedHours || 3} hours)
                        </li>
                      ))}
                      {myAssignments.filter((a: any) => a.status === 'completed').length === 0 && (
                        <li>No completed activities yet</li>
                      )}
                    </ul>
                  </div>
                </div>

                <div className="mb-6">
                  <h5 className="font-medium text-gray-900 mb-3">Reflection</h5>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows={4}
                    placeholder="Share your thoughts about this week's activities..."
                    defaultValue="This week was very rewarding. The tutoring program helped me connect with young students and see their progress. The digital literacy workshop was challenging but fulfilling as I helped seniors learn basic computer skills."
                  />
                </div>

                <div>
                  <h5 className="font-medium text-gray-900 mb-3">Goals for Next Week</h5>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows={3}
                    placeholder="Set your goals for the upcoming week..."
                    defaultValue="Continue with the tutoring program and help more students. Improve my teaching methods based on feedback."
                  />
                </div>
              </div>

                          </div>
          )}

          {activeTab === 'map' && (
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Map</h3>
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">View volunteer opportunities near you. Click on markers for details.</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">My Location</Button>
                    <Button size="sm" variant="outline">Filter by Distance</Button>
                    <Button size="sm" variant="outline">Show Available Only</Button>
                  </div>
                </div>
                <InteractiveMap />
              </div>
            </div>
          )}

          {/* Task Details Modal */}
          {showTaskDetails && selectedTask && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Task Details</h3>
                  <button 
                    onClick={() => setShowTaskDetails(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ×
                  </button>
                </div>
                <div className="space-y-6">
                  <div className="flex items-start space-x-4">
                    <div className="flex-1">
                      <h4 className="font-semibold text-xl text-gray-900 mb-3">{selectedTask.title}</h4>
                      <p className="text-sm text-gray-600 mb-4 leading-relaxed">{selectedTask.description}</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="space-y-3">
                          <div>
                            <span className="text-gray-500 text-sm font-medium">📍 Location:</span>
                            <p className="font-medium text-gray-900">{selectedTask.city}</p>
                            {selectedTask.address && (
                              <p className="text-sm text-gray-600 mt-1">{selectedTask.address}</p>
                            )}
                          </div>
                          <div>
                            <span className="text-gray-500 text-sm font-medium">🔥 Urgency:</span>
                            <div className="mt-1">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                selectedTask.urgency === 'critical' ? 'bg-red-100 text-red-800' :
                                selectedTask.urgency === 'high' ? 'bg-orange-100 text-orange-800' :
                                selectedTask.urgency === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                {selectedTask.urgency?.toUpperCase() || 'MEDIUM'}
                              </span>
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500 text-sm font-medium">📋 Status:</span>
                            <div className="mt-1">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                selectedTask.status === 'open' ? 'bg-green-100 text-green-800' :
                                selectedTask.status === 'assigned' ? 'bg-blue-100 text-blue-800' :
                                selectedTask.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {selectedTask.status?.toUpperCase() || 'OPEN'}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <div>
                            <span className="text-gray-500 text-sm font-medium">🛠️ Required Skill:</span>
                            <p className="font-medium text-gray-900 mt-1">{selectedTask.requiredSkill || 'General'}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 text-sm font-medium">📅 Created Date:</span>
                            <p className="font-medium text-gray-900 mt-1">
                              {selectedTask.createdAt ? new Date(selectedTask.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              }) : 'Recently'}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500 text-sm font-medium">🔄 Last Updated:</span>
                            <p className="font-medium text-gray-900 mt-1">
                              {selectedTask.updatedAt ? new Date(selectedTask.updatedAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              }) : 'Recently'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {selectedTask.address && (
                        <div className="bg-gray-50 p-4 rounded-lg mb-4">
                          <span className="text-gray-500 text-sm font-medium">📧 Full Address:</span>
                          <p className="font-medium text-gray-900 mt-1">{selectedTask.address}</p>
                          <p className="text-sm text-gray-600 mt-1">{selectedTask.city}</p>
                        </div>
                      )}

                      <div className="bg-blue-50 p-4 rounded-lg mb-4">
                        <span className="text-blue-700 text-sm font-medium">ℹ️ Task Information:</span>
                        <div className="mt-2 text-sm text-gray-700">
                          <p>• This task requires <strong>{selectedTask.requiredSkill || 'general'}</strong> skills</p>
                          <p>• Location: <strong>{selectedTask.city}</strong></p>
                          <p>• Urgency level: <strong>{selectedTask.urgency || 'medium'}</strong></p>
                          {selectedTask.address && <p>• Address provided for navigation</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 pt-4 border-t border-gray-200">
                    <Button 
                      className="bg-green-600 hover:bg-green-700 flex-1"
                      onClick={() => handleAcceptTask(selectedTask)}
                      disabled={selectedTask.status !== 'open'}
                    >
                      {selectedTask.status === 'open' ? 'Accept Task' : 'Task Not Available'}
                    </Button>
                    <Button variant="outline" onClick={() => setShowTaskDetails(false)}>
                      Close
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Notification System */}
        <NotificationUI 
          notifications={notifications} 
          onRemove={removeNotification} 
        />
      </div>
      </div>
    </div>
  );
}
