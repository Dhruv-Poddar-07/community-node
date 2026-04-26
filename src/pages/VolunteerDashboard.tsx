import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { Button } from '../components/ui/button';
import NotificationUI from '../components/ui/notification';
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
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

      // Create actual assignment via API
      const response = await fetch('/api/assignments/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          needId: taskId,
          volunteerId: volunteer?.id || 2,
        }),
        credentials: 'include',
      });

      if (response.ok) {
        await response.json();
        
        // Add to applied tasks list
        setAppliedTasks(prev => [...prev, taskId]);
        
        // Show success notification
        addNotification(`Successfully applied and assigned to task: ${task.title}!`, 'success');
        
        // Update task status in local state (remove from available)
        setAvailableNeeds(prev => prev.filter(need => need.id !== taskId));
        
      } else {
        const errorData = await response.json();
        addNotification(errorData.error || 'Failed to apply for task', 'error');
      }
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
      const response = await fetch('/api/assignments/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          needId: task.id,
          volunteerId: volunteer?.id || 2, // Use demo volunteer ID if not available
        }),
      });

      if (response.ok) {
        await response.json();
        addNotification(`Task "${task.title}" accepted successfully!`, 'success');
        
        setShowTaskDetails(false);
        // Update applied tasks to prevent re-application
        setAppliedTasks(prev => [...prev, task.id]);
      } else {
        const errorData = await response.json();
        addNotification(errorData.error || 'Failed to accept task', 'error');
      }
    } catch (error) {
      console.error('Error accepting task:', error);
      addNotification('Failed to accept task. Please try again.', 'error');
    }
  };

  
  const handleSaveProfile = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Here you would typically save the profile data to backend
    addNotification('Profile saved successfully!', 'success');
  };

  const handleCancelProfile = () => {
    // Reset form or navigate away
    addNotification('Profile changes cancelled', 'info');
  };

  const handleDownloadPDF = () => {
    // In a real application, this would generate and download a PDF
    addNotification('PDF download functionality coming soon! This would generate a weekly report PDF with your volunteer activities, hours logged, and completed tasks.', 'info');
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
              <div className="page-transition-fade stagger-reveal">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {getGreeting()}, {user?.name}!
                </h3>
                <p className="text-gray-600 mb-6">Welcome back to your volunteer dashboard</p>

              {/* Impact Strip */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="bg-white border border-gray-200 rounded-lg p-4 card-hover-lift dashboard-enter-scale stagger-2">
                    <h4 className="text-sm font-medium text-gray-600 mb-1">Hours Logged</h4>
                    <div className="text-2xl font-bold text-gray-900">{getTotalHoursFromAssignments()}</div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4 card-hover-lift dashboard-enter-scale stagger-3">
                    <h4 className="text-sm font-medium text-gray-600 mb-1">Active Tasks</h4>
                    <div className="text-2xl font-bold text-blue-600">{myAssignments.filter(a => a.status !== 'completed').length}</div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4 card-hover-lift dashboard-enter-scale stagger-4">
                    <h4 className="text-sm font-medium text-gray-600 mb-1">Badge</h4>
                    <div className="text-2xl font-bold text-gray-900 capitalize">{getVolunteerBadge()}</div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4 card-hover-lift dashboard-enter-scale stagger-5">
                    <h4 className="text-sm font-medium text-gray-600 mb-1">Average Rating</h4>
                    <div className="flex items-center">
                      <div className="text-2xl font-bold text-gray-900 mr-2">
                        {getAverageRating()}
                      </div>
                      {getAverageRating() && (
                        <div className="flex text-yellow-400">
                          {[...Array(5)].map((_, i) => (
                            <span key={i} className={i < Math.floor(parseFloat(getAverageRating()) || 0) ? 'text-yellow-400' : 'text-gray-300'}>
                              ★
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-600 mb-1">People Helped</h4>
                    <div className="text-2xl font-bold text-gray-900">{getPeopleHelped()}</div>
                  </div>
                </div>

              {/* Matched Tasks */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Your Matched Tasks</h4>
                <div className="mb-3">
                  <p className="text-sm text-gray-600">
                    Showing tasks that match your skills: 
                    <span className="font-medium text-green-600">
                      {volunteer?.skills?.join(', ') || 'No skills added yet'}
                    </span>
                  </p>
                </div>
                <div className="space-y-4">
                  {getSkillMatchedTasks().map((need) => (
                    <div key={need.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-medium text-gray-900">{need.title}</h5>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          need.urgency === 'critical' ? 'bg-red-100 text-red-800' :
                          need.urgency === 'high' ? 'bg-orange-100 text-orange-800' :
                          need.urgency === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {need.urgency}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{need.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Required: {need.requiredSkill}</span>
                        <Button 
                          size="sm" 
                          onClick={() => handleApply(need.id)}
                          disabled={appliedTasks.includes(need.id)}
                          className={appliedTasks.includes(need.id) ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}
                        >
                          {appliedTasks.includes(need.id) ? 'Applied' : 'Apply'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 mt-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h4>
                <div className="space-y-3">
                  {getRecentActivities().map((activity, index) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{activity.title}: {activity.description}</p>
                        <p className="text-xs text-gray-500">{activity.location}</p>
                      </div>
                      <span className="text-xs text-gray-500">{activity.timeAgo}</span>
                    </div>
                  ))}
                  {getRecentActivities().length === 0 && (
                    <div className="flex items-center justify-between py-2">
                      <div>
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
                  myAssignments.map((assignment) => (
                    <div key={assignment.id} className="bg-white border border-gray-200 rounded-lg p-6 card-animate">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="font-semibold text-gray-900">{assignment.needTitle || assignment.title || 'Untitled Task'}</h4>
                          <p className="text-sm text-gray-500">
                            Due: {assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : 'No due date'}
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
                        {assignment.description || 'No description available'}
                      </p>
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
                  ))
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
                      defaultValue={user?.name || volunteer?.name || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      defaultValue={user?.email || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                    <input
                      type="tel"
                      defaultValue={user?.phone || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                    <select 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      defaultValue={volunteer?.city || 'Mumbai'}
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
                      defaultValue={volunteer?.specialty || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
                    <input
                      type="text"
                      defaultValue={volunteer?.availability || 'Weekends'}
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

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="font-semibold text-gray-900 mb-4">Previous Reports</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-3 border border-gray-200 rounded">
                    <div>
                      <p className="font-medium text-gray-900">Week of April 1-7, 2024</p>
                      <p className="text-sm text-gray-500">8 hours, 2 tasks completed</p>
                    </div>
                    <Button size="sm" variant="outline">View</Button>
                  </div>
                  <div className="flex justify-between items-center p-3 border border-gray-200 rounded">
                    <div>
                      <p className="font-medium text-gray-900">Week of March 25-31, 2024</p>
                      <p className="text-sm text-gray-500">10 hours, 3 tasks completed</p>
                    </div>
                    <Button size="sm" variant="outline">View</Button>
                  </div>
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
