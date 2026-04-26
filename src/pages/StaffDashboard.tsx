import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { Button } from '../components/ui/button';
import MapPicker from '../components/MapPicker';
import NotificationUI from '../components/ui/notification';
import InteractiveMap from '../components/InteractiveMap';
import CommunityChat from '../components/CommunityChat';

import {
  getAllVolunteers,
  getAllNeeds,
  getAllAssignments,
  createNeed,
  createAssignment
} from '../services/firestoreService';
import { setDoc, doc, Timestamp, updateDoc, collection, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  LayoutDashboard, 
  Users, 
  ClipboardList, 
  HandHelping, 
  Map, 
  MessageSquare,
  LogOut,
  Menu
} from 'lucide-react';
import { SKILLS } from '../constants/skills';

export default function StaffLayout() {
  const { user, logout } = useAuth();
  const { addNotification } = useNotifications();
  
    const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Set sidebar state based on screen size
  useEffect(() => {
    const checkScreenSize = () => {
      const isDesktop = window.innerWidth >= 1024; // lg breakpoint
      setSidebarOpen(isDesktop);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);
  const [showCreateAssignmentModal, setShowCreateAssignmentModal] = useState(false);
  const [showAddNeedModal, setShowAddNeedModal] = useState(false);
  const [showAddVolunteerModal, setShowAddVolunteerModal] = useState(false);
  const [showVolunteerDetailsModal, setShowVolunteerDetailsModal] = useState(false);
  const [selectedNeedForAssignment, setSelectedNeedForAssignment] = useState<string>('');
  const [showVolunteerSelectionModal, setShowVolunteerSelectionModal] = useState(false);
  const [selectedVolunteer, setSelectedVolunteer] = useState<any>(null);
  const [showAssignTaskModal, setShowAssignTaskModal] = useState(false);
  const [showAssignmentDetailsModal, setShowAssignmentDetailsModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [showNeedDetailsModal, setShowNeedDetailsModal] = useState(false);
  const [selectedNeed, setSelectedNeed] = useState<any>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedRating, setSelectedRating] = useState(5);
  const [ratingFeedback, setRatingFeedback] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
const [volunteers, setVolunteers] = useState<any[]>([]);
const [needs, setNeeds] = useState<any[]>([]);
const [assignments, setAssignments] = useState<any[]>([]);
const [dashboardStats, setDashboardStats] = useState({
  activeVolunteers: 0,
  openNeeds: 0,
  criticalNeeds: 0,
  hoursThisWeek: 0
});
const [recentActivity, setRecentActivity] = useState<any[]>([]);
const [loading, setLoading] = useState(true);
const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number; name?: string } | null>(null);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'needs', label: 'Community Needs', icon: ClipboardList },
    { id: 'volunteers', label: 'Volunteers', icon: Users },
    { id: 'assignments', label: 'Assignments', icon: HandHelping },
    { id: 'map', label: 'Live Map', icon: Map },
    { id: 'chat', label: 'Community Chat', icon: MessageSquare },
  ];

  const handleLogout = async () => {
    await logout();
  };

  // Set up global function for map popup clicks
  useEffect(() => {
    (window as any).mapNeedClick = (needId: number) => {
      const need = needs.find(n => n.id === needId);
      if (need) {
        setSelectedNeed(need);
        setShowNeedDetailsModal(true);
      }
    };
  }, [needs]);

  // Fetch dashboard data from Firestore and set up real-time listeners
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const [volunteersData, needsData] = await Promise.all([
          getAllVolunteers(),
          getAllNeeds()
        ]);

        setVolunteers(volunteersData);
        setNeeds(needsData);

        // Calculate dashboard stats
        const openNeedsCount = needsData.filter((need: any) => need.status === 'open').length;
        const criticalNeedsCount = needsData.filter((need: any) => 
          need.status === 'open' && need.urgency === 'Critical'
        ).length;
        const totalHours = volunteersData.reduce((sum: number, vol: any) => sum + (vol.hoursLogged || 0), 0);

        setDashboardStats({
          activeVolunteers: volunteersData.length,
          openNeeds: openNeedsCount,
          criticalNeeds: criticalNeedsCount,
          hoursThisWeek: totalHours
        });

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Set up real-time listener for assignments
  useEffect(() => {
    const assignmentsCollection = collection(db, 'assignments');
    const unsubscribe = onSnapshot(assignmentsCollection, (querySnapshot) => {
      const assignmentsData = querySnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      
      console.log('🔄 Real-time assignments update:', assignmentsData);
      setAssignments(assignmentsData);

      // Format recent activity
      const activity = assignmentsData.slice(0, 3).map((assignment: any) => ({
        id: assignment.id,
        type: assignment.status === 'completed' ? 'completed' : 'assigned',
        volunteer: assignment.volunteerName || assignment.volunteer || 'Unknown Volunteer',
        task: assignment.needTitle || assignment.taskTitle || assignment.title || 'Unknown Task',
        date: assignment.assignedDate?.toDate?.() || new Date(assignment.assignedDate || Date.now())
      }));
      setRecentActivity(activity);
    });

    return () => unsubscribe();
  }, []);

  // Set up real-time listener for needs to ensure dropdown is always updated
  useEffect(() => {
    const needsCollection = collection(db, 'needs');
    const unsubscribe = onSnapshot(needsCollection, (querySnapshot) => {
      const needsData = querySnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      setNeeds(needsData);
    });

    return () => unsubscribe();
  }, []);

  // Socket functionality removed - using Firebase only

  const handleCompleteAssignment = async (assignmentId: string) => {
    try {
      
      // Find the assignment to get the needId
      const assignment = assignments.find(a => a.id === assignmentId);
      
      // Update assignment status in Firestore
      const assignmentRef = doc(db, 'assignments', assignmentId);
      await updateDoc(assignmentRef, {
        status: 'completed',
        completedDate: Timestamp.now()
      });
      
      
      // Also update the related need status to completed in needs collection
      if (assignment?.needId) {
        const needRef = doc(db, 'needs', assignment.needId);
        await updateDoc(needRef, {
          status: 'completed',
          updatedAt: Timestamp.now()
        });
        
      }
      
      // Update local state
      if (assignment) {
        assignment.status = 'completed';
        assignment.completedDate = new Date();
        setAssignments([...assignments]);
      }
      
      addNotification('Assignment and related need marked as completed!', 'success');
    } catch (error) {
      addNotification('Failed to complete assignment', 'error');
    }
  };

  const handleStartAssignment = async (assignmentId: string) => {
    try {
      
      // Update assignment status in Firestore
      const assignmentRef = doc(db, 'assignments', assignmentId);
      await updateDoc(assignmentRef, {
        status: 'active',
        startedDate: Timestamp.now()
      });
      
      
      addNotification('Assignment started successfully!', 'success');
    } catch (error) {
      addNotification('Failed to start assignment', 'error');
    }
  };

  const handleMarkNeedCompleted = async (needId: string) => {
    try {
      
      // Update need status to completed in Firestore
      const needRef = doc(db, 'needs', needId);
      await updateDoc(needRef, {
        status: 'completed',
        updatedAt: Timestamp.now()
      });
      
      
      addNotification('Need marked as completed!', 'success');
      
      // Refresh needs data
      const needsData = await getAllNeeds();
      setNeeds(needsData);
    } catch (error) {
      addNotification('Failed to mark need as completed', 'error');
    }
  };

  const handleViewAssignment = (assignmentId: number) => {
    const assignment = assignments.find(a => a.id === assignmentId);
    if (assignment) {
      setSelectedAssignment(assignment);
      setShowAssignmentDetailsModal(true);
    }
  };

  const handleCreateAssignment = () => {
    setSelectedNeedForAssignment(''); // Reset selected need when opening modal
    setShowCreateAssignmentModal(true);
  };

  const handleAddNeed = () => {
    setSelectedLocation(null); // Reset location when opening modal
    setShowAddNeedModal(true);
  };

  const handleSubmitNeed = async (newNeed: any) => {
    try {
      
      // Create need in Firestore
      await createNeed(newNeed);
      
      
      // Refresh needs list to get the new need
      const needsData = await getAllNeeds();
      setNeeds(needsData);
      
      // Close modal and reset location
      setShowAddNeedModal(false);
      setSelectedLocation(null);
      
      addNotification('Need added successfully!', 'success');
      
      // Socket functionality removed - using Firebase only
    } catch (error) {
      addNotification('Failed to add need', 'error');
    }
  };

  const handleAddVolunteer = () => {
    setShowAddVolunteerModal(true);
  };

  const handleSubmitVolunteer = async (newVolunteer: any) => {
    try {
      // Generate a unique ID for the volunteer
      const volunteerId = `volunteer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Save to users collection only (combined user + volunteer data)
      const userRef = doc(db, 'users', volunteerId);
      await setDoc(userRef, {
        id: volunteerId,
        name: newVolunteer.name,
        email: newVolunteer.email,
        phone: newVolunteer.phone,
        city: newVolunteer.city,
        skills: newVolunteer.skills || [], // Multiple skills array
        specialty: newVolunteer.specialty || '',
        availability: newVolunteer.availability || '',
        role: 'volunteer',
        hoursLogged: 0,
        tasksCompleted: 0,
        badge: 'Newcomer',
        status: 'active',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      
      // Update local state
      const id = volunteers.length > 0 ? Math.max(...volunteers.map(v => v.id)) + 1 : 1;
      setVolunteers([...volunteers, { 
        ...newVolunteer, 
        id, 
        hoursLogged: 0, 
        tasksDone: 0, 
        level: 'Contributor',
        firebaseId: volunteerId
      }]);
      
      setShowAddVolunteerModal(false);
      addNotification('Volunteer added successfully to Firestore!', 'success');
    } catch (error) {
      addNotification('Failed to add volunteer', 'error');
    }
  };

  const handleSubmitAssignment = async (newAssignment: any) => {
    
    try {
      // Find volunteer ID from volunteer name
      const selectedVolunteer = volunteers.find(v => v.name === newAssignment.volunteer);
      
      if (!selectedVolunteer) {
        return;
      }

      // Find the need to get its title for display
      const selectedNeed = needs.find(need => need.id === newAssignment.need);
      
      // Save to Firestore assignments collection
      const assignmentData = {
        volunteerId: selectedVolunteer.id, // Use volunteer's UID
        needId: newAssignment.need, // Save the document ID
        needTitle: selectedNeed?.title || 'Unknown Need', // Save title for display
        status: 'pending',
        assignedDate: Timestamp.now(),
        dueDate: newAssignment.dueDate || null,
        notes: newAssignment.notes || ''
      };
      

      await createAssignment(assignmentData);
      
      setShowCreateAssignmentModal(false);
      addNotification('Assignment created successfully!', 'success');
    } catch (error) {
      addNotification('Failed to create assignment', 'error');
    }
  };

  const handleViewVolunteerDetails = (volunteer: any) => {
    setSelectedVolunteer(volunteer);
    setShowVolunteerDetailsModal(true);
  };

  const handleAssignTask = () => {
    setShowVolunteerDetailsModal(false);
    setShowAssignTaskModal(true);
  };

  const handleQuickAssign = (need: any) => {
    setSelectedNeed(need);
    // Show volunteer selection modal first
    setShowVolunteerSelectionModal(true);
  };

  const handleSelectVolunteerForAssignment = (volunteer: any) => {
    setSelectedVolunteer(volunteer);
    setShowVolunteerSelectionModal(false);
    setShowAssignTaskModal(true);
  };

  
  const handleSubmitTaskAssignment = async (taskData: any) => {
    try {
      if (!selectedNeed || !selectedVolunteer) {
        addNotification('Please select both need and volunteer', 'error');
        return;
      }

      // Create assignment in Firestore
      const assignmentData = {
        needId: selectedNeed.id,
        needTitle: selectedNeed.title,
        volunteerId: selectedVolunteer.id,
        volunteerName: selectedVolunteer.name,
        volunteerEmail: selectedVolunteer.email,
        staffId: 'current_staff', // This should come from current user
        status: 'pending',
        assignedDate: new Date().toISOString(),
        notes: taskData.notes || ''
      };

      await createAssignment(assignmentData);

      // Update need status to 'assigned'
      await updateDoc(doc(db, 'needs', selectedNeed.id), {
        status: 'assigned',
        assignedTo: selectedVolunteer.name,
        assignedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // Refresh data
      const [updatedNeeds, updatedAssignments] = await Promise.all([
        getAllNeeds(),
        getAllAssignments()
      ]);
      setNeeds(updatedNeeds);
      setAssignments(updatedAssignments);

      setShowAssignTaskModal(false);
      setSelectedNeed(null);
      setSelectedVolunteer(null);
      
      addNotification(`Task assigned successfully to ${selectedVolunteer.name}!`, 'success');
      
      // TODO: Send notification to volunteer (implement notification system)
      
    } catch (error) {
      console.error('Error assigning task:', error);
      addNotification('Failed to assign task', 'error');
    }
  };

  const handleRateVolunteer = (assignment: any) => {
    setSelectedAssignment(assignment);
    setSelectedRating(5);
    setRatingFeedback('');
    setShowRatingModal(true);
  };

  const handleSearchVolunteers = (term: string) => {
    setSearchTerm(term);
  };

  const filteredVolunteers = volunteers.filter(volunteer => 
    volunteer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    volunteer.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
    volunteer.skills.some((skill: string) => skill.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="flex h-screen bg-gray-50 relative">
      
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        fixed lg:relative z-50 h-full
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
        lg:translate-x-0
        transition-all duration-300 ease-in-out
        ${sidebarOpen ? 'w-64 lg:w-64' : 'w-20 lg:w-64'} 
        sidebar sidebar-animate flex flex-col
      `}>
        {/* Logo */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">CN</span>
            </div>
            {sidebarOpen && (
              <div>
                <h1 className="text-white font-semibold">Community Node</h1>
                <p className="text-gray-400 text-xs">Staff Portal</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-1">
            <div className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">
              {sidebarOpen && 'Overview'}
            </div>
            {menuItems.slice(0, 1).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full sidebar-item flex items-center space-x-3 animate-pulse-hover ${
                    activeTab === item.id ? 'active' : ''
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {sidebarOpen && <span>{item.label}</span>}
                </button>
              );
            })}

            <div className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3 mt-6">
              {sidebarOpen && 'Manage'}
            </div>
            {menuItems.slice(1, 5).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full sidebar-item flex items-center space-x-3 animate-pulse-hover ${
                    activeTab === item.id ? 'active' : ''
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {sidebarOpen && <span>{item.label}</span>}
                </button>
              );
            })}

            <div className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3 mt-6">
              {sidebarOpen && 'Explore'}
            </div>
            {menuItems.slice(5).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full sidebar-item flex items-center space-x-3 animate-pulse-hover ${
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
                {user?.name?.charAt(0).toUpperCase() || 'A'}
              </span>
            </div>
            {sidebarOpen && (
              <div className="flex-1">
                <p className="text-white text-sm font-medium">{user?.name || 'Admin User'}</p>
                <p className="text-gray-400 text-xs capitalize">{user?.role || 'Admin'}</p>
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
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative z-10">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 lg:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden btn-secondary-hover btn-touch-feedback"
              >
                <Menu className="w-5 h-5" />
              </Button>
              <h2 className="text-lg lg:text-xl font-semibold text-gray-900">
                {menuItems.find(item => item.id === activeTab)?.label || 'Dashboard'}
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
        <main className="flex-1 overflow-auto p-4 lg:p-6 content-fade">
          {activeTab === 'dashboard' && (
            <div className="page-transition-fade stagger-reveal">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Staff Dashboard</h3>
              
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-gray-500">Loading dashboard data...</div>
                </div>
              ) : (
                <>
                  {/* Critical Needs Card */}
                  <div className="bg-red-50 border-2 border-red-400 rounded-lg p-6 mb-6">
                    <h4 className="text-lg font-semibold text-red-900 mb-2">Critical Needs</h4>
                    <div className="text-3xl font-bold text-red-600 mb-4 pulse-glow">
                      {dashboardStats.criticalNeeds} Active
                    </div>
                    <div className="space-y-2">
                      {needs
                        .filter((need: any) => need.status === 'open' && need.urgency === 'Critical')
                        .slice(0, 3)
                        .map((need: any, index: number) => (
                          <div key={need.id} className="text-sm text-red-700">
                            {index + 1}. {need.title} - {need.city}
                          </div>
                        ))}
                      {dashboardStats.criticalNeeds === 0 && (
                        <div className="text-sm text-red-700">No critical needs at the moment</div>
                      )}
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white border border-gray-200 rounded-lg p-4 card-lift card-hover-lift dashboard-enter-scale stagger-2">
                      <h4 className="text-sm font-medium text-gray-600 mb-1">Active Volunteers</h4>
                      <div className="text-2xl font-bold text-gray-900">
                        {dashboardStats.activeVolunteers || 0}
                      </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-4 card-lift card-hover-lift dashboard-enter-scale stagger-3">
                      <h4 className="text-sm font-medium text-gray-600 mb-1">Open Needs</h4>
                      <div className="text-2xl font-bold text-gray-900">
                        {dashboardStats.openNeeds || 0}
                      </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-4 card-lift card-hover-lift dashboard-enter-scale stagger-4">
                      <h4 className="text-sm font-medium text-gray-600 mb-1">Hours This Week</h4>
                      <div className="text-2xl font-bold text-gray-900">
                        {dashboardStats.hoursThisWeek || 0}
                      </div>
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h4>
                    <div className="space-y-3">
                      {recentActivity.length > 0 ? (
                        recentActivity.map((activity: any) => (
                          <div key={activity.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {activity.type === 'completed' 
                                  ? `${activity.volunteer} completed assignment`
                                  : `${activity.volunteer} assigned to task`
                                }
                              </p>
                              <p className="text-xs text-gray-500">{activity.task}</p>
                            </div>
                            <span className="text-xs text-gray-500">
                              {activity.date ? 
                                `${Math.floor((Date.now() - activity.date.getTime()) / (1000 * 60 * 60))} hours ago` 
                                : 'Recently'
                              }
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-gray-500">No recent activity yet</div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'needs' && (
            <div className="w-full overflow-hidden">
              <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                <h3 className="text-2xl font-bold text-gray-900 flex-shrink-0">Community Needs</h3>
                <Button onClick={handleAddNeed} className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 flex-shrink-0 btn-primary-hover btn-touch-feedback">
                  + Add Need
                </Button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-gray-500">Loading community needs...</div>
                </div>
              ) : needs.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="text-gray-500 mb-2">No community needs found</div>
                    <Button onClick={handleAddNeed} className="btn-primary-hover btn-touch-feedback">Add First Need</Button>
                  </div>
                </div>
              ) : (
                /* Responsive Needs Table */
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-hidden">
                    <table className="w-full divide-y divide-gray-200 table-fixed">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{width: '40%'}}>
                            Need Details
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell" style={{width: '15%'}}>
                            City
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell" style={{width: '12%'}}>
                            Urgency
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell" style={{width: '12%'}}>
                            Status
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell" style={{width: '13%'}}>
                            Required Skill
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{width: '20%'}}>
                            Actions
                          </th>
                        </tr>
                      </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {needs.map((need: any) => (
                        <tr key={need.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="max-w-xs lg:max-w-sm">
                              <div className="text-sm font-medium text-gray-900 truncate" title={need.title || 'Untitled Need'}>{need.title || 'Untitled Need'}</div>
                              <div className="text-sm text-gray-500 mt-1" style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              }}>
                                {need.description || 'No description'}
                              </div>
                              {/* Mobile-only badges */}
                              <div className="sm:hidden mt-2 flex flex-wrap gap-1">
                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  need.urgency === 'Critical' ? 'bg-red-100 text-red-800' :
                                  need.urgency === 'High' ? 'bg-orange-100 text-orange-800' :
                                  need.urgency === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-green-100 text-green-800'
                                }`}>
                                  {need.urgency || 'Low'}
                                </span>
                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  need.status === 'open' ? 'bg-yellow-100 text-yellow-800' :
                                  need.status === 'Assigned' ? 'bg-blue-100 text-blue-800' :
                                  'bg-green-100 text-green-800'
                                }`}>
                                  {need.status || 'Unknown'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 hidden sm:table-cell">
                            {need.city || 'Unknown Location'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap hidden md:table-cell">
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              need.urgency === 'Critical' ? 'bg-red-100 text-red-800' :
                              need.urgency === 'High' ? 'bg-orange-100 text-orange-800' :
                              need.urgency === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {need.urgency || 'Low'}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap hidden lg:table-cell">
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              need.status === 'open' ? 'bg-yellow-100 text-yellow-800' :
                              need.status === 'Assigned' ? 'bg-blue-100 text-blue-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {need.status || 'Unknown'}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 hidden xl:table-cell">
                            {need.skill || need.requiredSkill || 'Not specified'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                            <div className="flex flex-col sm:flex-row gap-2">
                              {need.status !== 'completed' && (
                                <Button size="sm" className="btn-primary-hover btn-touch-feedback text-xs px-2 py-1" onClick={() => handleQuickAssign(need)}>Quick Assign</Button>
                              )}
                              {need.status !== 'completed' && (
                                <Button size="sm" variant="outline" className="bg-green-600 hover:bg-green-700 text-white btn-secondary-hover btn-touch-feedback text-xs px-2 py-1" onClick={() => handleMarkNeedCompleted(need.id)}>
                                  Complete
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              )}
            </div>
          )}

          {activeTab === 'volunteers' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Volunteers</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search by name, city, or skills..."
                    value={searchTerm}
                    onChange={(e) => handleSearchVolunteers(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md w-64"
                  />
                  <Button className="bg-green-600 hover:bg-green-700 btn-primary-hover btn-touch-feedback" onClick={handleAddVolunteer}>
                    + Add Volunteer
                  </Button>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-gray-500">Loading volunteers...</div>
                </div>
              ) : filteredVolunteers.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="text-gray-500 mb-2">No volunteers found</div>
                    {searchTerm && (
                      <Button variant="outline" onClick={() => setSearchTerm('')} className="btn-secondary-hover btn-touch-feedback">
                        Clear search
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                /* Volunteer Cards Grid */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredVolunteers.map((volunteer: any) => (
                    <div key={volunteer.id} className="bg-white border border-gray-200 rounded-lg p-6 card-lift card-glow hover:shadow-xl hover:scale-105 transition-all duration-300 ease-in-out transform">
                      <div className="flex items-center mb-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold mr-4 ${
                          volunteer.badge === 'Champion' ? 'bg-orange-500' :
                          volunteer.badge === 'Active' ? 'bg-purple-500' :
                          volunteer.badge === 'Contributor' ? 'bg-blue-500' : 'bg-gray-500'
                        }`}>
                          {(volunteer.name || '').split(' ').map((n: string) => n[0]).join('') || 'V'}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">{volunteer.name || 'Unknown Volunteer'}</h4>
                          <p className="text-sm text-gray-500">{volunteer.city || 'Unknown Location'}</p>
                        </div>
                      </div>
                      
                      <div className="mb-4">
                        <div className="flex flex-wrap gap-2 mb-3">
                          {(volunteer.skills || []).map((skill: string, index: number) => (
                            <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                              {skill}
                            </span>
                          ))}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          <strong>Specialty:</strong> {volunteer.specialty || 'Not specified'}
                        </p>
                        <p className="text-sm text-gray-600">
                          <strong>Availability:</strong> {volunteer.availability || 'Not specified'}
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                        <div>
                          <p className="text-gray-500">Hours Logged</p>
                          <p className="font-semibold text-gray-900">{volunteer.hoursLogged || 0}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Tasks Done</p>
                          <p className="font-semibold text-gray-900">{volunteer.tasksDone || volunteer.tasksCompleted || 0}</p>
                        </div>
                      </div>
                      
                      <div className="mb-4">
                        <p className="text-gray-500 text-sm mb-1">Average Rating</p>
                        <div className="flex items-center">
                          {volunteer.averageRating ? (
                            <>
                              <span className="font-semibold text-gray-900 mr-2">
                                {volunteer.averageRating.toFixed(1)}
                              </span>
                              <div className="flex text-yellow-400">
                                {[...Array(5)].map((_, i) => (
                                  <span key={i} className={i < Math.floor(volunteer.averageRating) ? 'text-yellow-400' : 'text-gray-300'}>
                                    ★
                                  </span>
                                ))}
                              </div>
                              <span className="text-xs text-gray-500 ml-2">
                                ({volunteer.ratingsCount || 0} {volunteer.ratingsCount === 1 ? 'rating' : 'ratings'})
                              </span>
                            </>
                          ) : (
                            <span className="text-gray-400 text-sm">No ratings yet</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          volunteer.badge === 'Champion' ? 'bg-orange-100 text-orange-800' :
                          volunteer.badge === 'Active' ? 'bg-purple-100 text-purple-800' :
                          volunteer.badge === 'Contributor' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {volunteer.badge || 'Newcomer'}
                        </span>
                        <Button size="sm" variant="outline" onClick={() => handleViewVolunteerDetails(volunteer)} className="btn-secondary-hover btn-touch-feedback">
                          View Details
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'assignments' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Assignments</h3>
                <Button onClick={handleCreateAssignment} className="bg-green-600 hover:bg-green-700 btn-animate">
                  + Create Assignment
                </Button>
              </div>

              {/* Assignment Stats */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-white border border-gray-200 rounded-lg p-4 card-animate">
                  <h4 className="text-sm font-medium text-gray-600 mb-1">Total Assignments</h4>
                  <div className="text-2xl font-bold text-gray-900">{assignments.length}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4 card-animate">
                  <h4 className="text-sm font-medium text-gray-600 mb-1">Active</h4>
                  <div className="text-2xl font-bold text-blue-600">{assignments.filter(a => a.status === 'active').length}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4 card-animate">
                  <h4 className="text-sm font-medium text-gray-600 mb-1">Completed</h4>
                  <div className="text-2xl font-bold text-green-600">{assignments.filter(a => a.status === 'completed').length}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4 card-animate">
                  <h4 className="text-sm font-medium text-gray-600 mb-1">Pending</h4>
                  <div className="text-2xl font-bold text-yellow-600">{assignments.filter(a => a.status === 'pending').length}</div>
                </div>
              </div>

              {/* Assignments Cards */}
              <div className="space-y-4 w-full">
                {assignments.map((assignment) => (
                  <div key={assignment.id} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow duration-200 w-full">
                    {/* Volunteer Info */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold mr-3 ${
                          assignment.volunteer === 'Demo Volunteer' ? 'bg-blue-500' :
                          assignment.volunteer === 'Priya Sharma' ? 'bg-green-500' :
                          assignment.volunteer === 'Rahul Kumar' ? 'bg-purple-500' :
                          assignment.volunteer === 'Ananya Patel' ? 'bg-pink-500' : 'bg-yellow-500'
                        }`}>
                          {(assignment.volunteer || '').split(' ').map((n: string) => n[0]).join('') || 'V'}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{assignment.volunteer}</div>
                          <div className="text-xs text-gray-500">
                            {assignment.volunteerCity || 'Unknown'}
                          </div>
                        </div>
                      </div>
                      
                      {/* Status Badge */}
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        assignment.status === 'active' ? 'bg-blue-100 text-blue-800' :
                        assignment.status === 'completed' ? 'bg-green-100 text-green-800' :
                        assignment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {assignment.status === 'active' ? 'Active' : 
                         assignment.status === 'completed' ? 'Completed' : 
                         assignment.status === 'pending' ? 'Pending' : 
                         assignment.status}
                      </span>
                    </div>

                    {/* Need Title */}
                    <div className="mb-4">
                      <h4 className="text-lg font-semibold text-gray-900 mb-2">{assignment.needTitle || assignment.need}</h4>
                      <p className="text-sm text-gray-600">
                        {needs.find(n => n.id === assignment.needId)?.description?.substring(0, 100) + '...' || 'Community service'}
                      </p>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div>
                        <span className="text-xs text-gray-500 uppercase tracking-wider">Assigned Date</span>
                        <p className="text-sm text-gray-900 mt-1">
                          {assignment.assignedDate?.toDate?.()?.toLocaleDateString() || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 uppercase tracking-wider">Due Date</span>
                        <p className="text-sm text-gray-900 mt-1">
                          {assignment.dueDate?.toDate?.()?.toLocaleDateString() || assignment.dueDate || 'N/A'}
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => handleViewAssignment(assignment.id)}>View</Button>
                      {assignment.status === 'pending' && (
                        <Button size="sm" variant="outline" onClick={() => handleStartAssignment(assignment.id)}>Start</Button>
                      )}
                      {assignment.status === 'active' && (
                        <Button size="sm" variant="outline" onClick={() => handleCompleteAssignment(assignment.id)}>Complete</Button>
                      )}
                      {assignment.status === 'completed' && (
                        assignment.rating ? (
                          <Button size="sm" variant="outline" disabled className="opacity-50 cursor-not-allowed">
                            Rated ({assignment.rating}⭐)
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => handleRateVolunteer(assignment)}>Rate</Button>
                        )
                      )}
                      {(assignment.status === 'active' || assignment.status === 'completed') && (
                        <Button size="sm" variant="outline" onClick={() => addNotification('Report functionality coming soon!', 'info')}>Report</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'map' && (
            <div className="page-transition-fade stagger-reveal">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Live Map</h3>
              <p className="text-gray-600 mb-6">Real-time volunteer needs across India. Click on markers for details.</p>
              <InteractiveMap />
            </div>
          )}

          {activeTab === 'chat' && (
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Community Chat</h3>
              <CommunityChat />
            </div>
          )}

          {/* Add Need Modal */}
          {showAddNeedModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg p-4 lg:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto lg:mx-4 modal-scale-in">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-semibold text-gray-900">Add Community Need</h3>
                  <button
                    onClick={() => {
                      setShowAddNeedModal(false);
                      setSelectedLocation(null);
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (!selectedLocation) {
                    addNotification('Please select a location on the map', 'error');
                    return;
                  }
                  
                  const formData = new FormData(e.currentTarget);
                  const newNeed = {
                    title: formData.get('title'),
                    description: formData.get('description'),
                    category: 'Community Service', // Default category
                    city: formData.get('city'),
                    lat: selectedLocation.lat,
                    lng: selectedLocation.lng,
                    urgency: formData.get('urgency'),
                    requiredSkill: formData.get('skill')
                  };
                  handleSubmitNeed(newNeed);
                }}>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                      <input
                        type="text"
                        name="title"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="Enter need title"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">City *</label>
                      <select
                        name="city"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        <option value="">Select city</option>
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
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                    <textarea
                      name="description"
                      required
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Describe the community need"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Location *</label>
                    <MapPicker 
                      onLocationSelect={(lat, lng, name) => {
                        setSelectedLocation({ lat, lng, name });
                      }}
                    />
                    <input
                      type="hidden"
                      name="latitude"
                      value={selectedLocation?.lat || ''}
                      required
                    />
                    <input
                      type="hidden"
                      name="longitude"
                      value={selectedLocation?.lng || ''}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Urgency *</label>
                      <select
                        name="urgency"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        <option value="">Select urgency</option>
                        <option value="Critical">Critical</option>
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Required Skill *</label>
                      <select
                        name="skill"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        <option value="">Select skill</option>
                        {SKILLS.map(skill => (
                          <option key={skill} value={skill}>{skill}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowAddNeedModal(false);
                        setSelectedLocation(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" className="bg-green-600 hover:bg-green-700">
                      Add Need
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Add Volunteer Modal */}
          {showAddVolunteerModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in">
              <div className="bg-white rounded-lg p-4 lg:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Add New Volunteer</h3>
                  <button 
                    onClick={() => setShowAddVolunteerModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ×
                  </button>
                </div>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const selectedSkills = SKILLS.filter(skill => 
                    formData.getAll('skills').includes(skill)
                  );
                  handleSubmitVolunteer({
                    name: formData.get('name') as string,
                    city: formData.get('city') as string,
                    skills: selectedSkills,
                    specialty: formData.get('specialty') as string,
                    availability: formData.get('availability') as string,
                    email: formData.get('email') as string,
                    phone: formData.get('phone') as string,
                  });
                }}>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                      <input
                        type="text"
                        name="name"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        name="email"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input
                        type="tel"
                        name="phone"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                      <select name="city" required className="w-full px-3 py-2 border border-gray-300 rounded-md">
                        <option value="">Select City</option>
                        <option value="Mumbai">Mumbai</option>
                        <option value="Delhi">Delhi</option>
                        <option value="Bangalore">Bangalore</option>
                        <option value="Chennai">Chennai</option>
                        <option value="Kolkata">Kolkata</option>
                        <option value="Hyderabad">Hyderabad</option>
                        <option value="Pune">Pune</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Skills *</label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {SKILLS.map(skill => (
                          <label key={skill} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              name="skills"
                              value={skill}
                              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                            />
                            <span className="text-sm">{skill}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Specialty</label>
                      <input
                        type="text"
                        name="specialty"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Availability</label>
                      <select name="availability" required className="w-full px-3 py-2 border border-gray-300 rounded-md">
                        <option value="">Select Availability</option>
                        <option value="Weekdays">Weekdays</option>
                        <option value="Weekends">Weekends</option>
                        <option value="Flexible">Flexible</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddVolunteerModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" className="bg-green-600 hover:bg-green-700">
                      Add Volunteer
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Volunteer Details Modal */}
          {showVolunteerDetailsModal && selectedVolunteer && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in">
              <div className="bg-white rounded-lg p-4 lg:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Volunteer Details</h3>
                  <button 
                    onClick={() => setShowVolunteerDetailsModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ×
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center mb-4">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold mr-4 text-xl ${
                      selectedVolunteer.level === 'Champion' ? 'bg-orange-500' :
                      selectedVolunteer.level === 'Active' ? 'bg-purple-500' :
                      selectedVolunteer.level === 'Contributor' ? 'bg-blue-500' : 'bg-gray-500'
                    }`}>
                      {(selectedVolunteer.name || '').split(' ').map((n: string) => n[0]).join('') || 'V'}
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold text-gray-900">{selectedVolunteer.name}</h4>
                      <p className="text-sm text-gray-500">{selectedVolunteer.city}</p>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        selectedVolunteer.level === 'Champion' ? 'bg-orange-100 text-orange-800' :
                        selectedVolunteer.level === 'Active' ? 'bg-purple-100 text-purple-800' :
                        selectedVolunteer.level === 'Contributor' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedVolunteer.level}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Email</p>
                      <p className="font-medium text-gray-900">{selectedVolunteer.email}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Phone</p>
                      <p className="font-medium text-gray-900">{selectedVolunteer.phone}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Specialty</p>
                      <p className="font-medium text-gray-900">{selectedVolunteer.specialty}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Availability</p>
                      <p className="font-medium text-gray-900">{selectedVolunteer.availability}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Hours Logged</p>
                      <p className="font-medium text-gray-900">{selectedVolunteer.hoursLogged}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Tasks Done</p>
                      <p className="font-medium text-gray-900">{selectedVolunteer.tasksDone}</p>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-gray-500 mb-2">Skills</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedVolunteer.skills.map((skill: string, index: number) => (
                        <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <Button variant="outline" onClick={() => setShowVolunteerDetailsModal(false)}>
                    Close
                  </Button>
                  <Button className="bg-green-600 hover:bg-green-700" onClick={handleAssignTask}>
                    Assign Task
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Create Assignment Modal */}
          {showCreateAssignmentModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in">
              <div className="bg-white rounded-lg p-4 lg:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto lg:mx-4 modal-scale-in">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Create New Assignment</h3>
                  <button 
                    onClick={() => setShowCreateAssignmentModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ×
                  </button>
                </div>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  handleSubmitAssignment({
                    volunteer: formData.get('volunteer'),
                    need: formData.get('need'),
                    dueDate: formData.get('dueDate'),
                  });
                }}>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Select Need</label>
                      <select 
                        name="need" 
                        required 
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        onChange={(e) => setSelectedNeedForAssignment(e.target.value)}
                      >
                        <option value="">Select Need</option>
                        {(() => {
                          const openNeeds = needs.filter(need => need.status === 'open');
                          return openNeeds.map((need) => (
                            <option key={need.id} value={need.id}>
                              {need.title} - {need.city}
                            </option>
                          ));
                        })()}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Select Volunteer</label>
                      <select name="volunteer" required className="w-full px-3 py-2 border border-gray-300 rounded-md">
                        <option value="">
                          {selectedNeedForAssignment ? 'Select Volunteer' : 'Please select a need first'}
                        </option>
                        {(() => {
                          if (!selectedNeedForAssignment) {
                            return null; // Don't show any volunteers until need is selected
                          }
                          
                          const selectedNeed = needs.find(need => need.id === selectedNeedForAssignment);
                          const needCity = selectedNeed?.city;
                          
                          
                          const filteredVolunteers = volunteers.filter(volunteer => volunteer.city === needCity);
                          
                          
                          return filteredVolunteers.map((volunteer) => (
                            <option key={volunteer.id} value={volunteer.name}>
                              {volunteer.name} - {volunteer.city}
                            </option>
                          ));
                        })()}
                      </select>
                      {selectedNeedForAssignment && (() => {
                        const selectedNeed = needs.find(need => need.id === selectedNeedForAssignment);
                        const filteredVolunteers = volunteers.filter(volunteer => volunteer.city === selectedNeed?.city);
                        
                        if (filteredVolunteers.length === 0) {
                          return (
                            <p className="text-sm text-red-600 mt-1">
                              No volunteers found in {selectedNeed?.city}. Please select a different need.
                            </p>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                      <input
                        type="date"
                        name="dueDate"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowCreateAssignmentModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" className="bg-green-600 hover:bg-green-700">
                      Create Assignment
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Need Details Modal */}
          {showNeedDetailsModal && selectedNeed && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
              <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">Need Details</h3>
                  <button 
                    onClick={() => setShowNeedDetailsModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ×
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center mb-4">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold mr-4 text-xl ${
                      selectedNeed.urgency === 'critical' ? 'bg-red-500' :
                      selectedNeed.urgency === 'high' ? 'bg-orange-500' :
                      selectedNeed.urgency === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                    }`}>
                      {selectedNeed.title.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xl font-semibold text-gray-900">{selectedNeed.title}</h4>
                      <p className="text-sm text-gray-500">{selectedNeed.city}</p>
                      <span className={`inline-block px-3 py-1 text-sm rounded-full ${
                        selectedNeed.urgency === 'critical' ? 'bg-red-100 text-red-800' :
                        selectedNeed.urgency === 'high' ? 'bg-orange-100 text-orange-800' :
                        selectedNeed.urgency === 'medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {selectedNeed.urgency.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Description</p>
                      <p className="font-medium text-gray-900">{selectedNeed.description}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Skills Required</p>
                      <p className="font-medium text-gray-900">{selectedNeed.skill}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Status</p>
                      <p className="font-medium text-gray-900">{selectedNeed.status}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Volunteers Assigned</p>
                      <p className="font-medium text-gray-900">{selectedNeed.assignedCount || 0}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 pt-4 border-t border-gray-200">
                    <Button variant="outline" onClick={() => setShowNeedDetailsModal(false)}>
                      Close
                    </Button>
                    <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleQuickAssign(selectedNeed)}>
                      Quick Assign
                    </Button>
                    <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => {
                      if (selectedNeed) {
                        window.location.href = `/volunteer-assignment?need=${selectedNeed.id}`;
                      }
                    }}>
                      Assign Volunteers
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Assign Task Modal */}
          {showAssignTaskModal && selectedVolunteer && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Assign Task to {selectedVolunteer.name}</h3>
                  <button 
                    onClick={() => setShowAssignTaskModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ×
                  </button>
                </div>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  handleSubmitTaskAssignment({
                    need: formData.get('need'),
                    dueDate: formData.get('dueDate'),
                  });
                }}>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Select Need</label>
                      <select name="need" required className="w-full px-3 py-2 border border-gray-300 rounded-md">
                        <option value="">Select Need</option>
                        {needs.filter(need => need.status === 'open').map((need) => (
                          <option key={need.id} value={need.id}>
                            {need.title} - {need.city}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                      <input
                        type="date"
                        name="dueDate"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div className="bg-gray-50 p-3 rounded-md">
                      <p className="text-sm text-gray-600">
                        <strong>Volunteer:</strong> {selectedVolunteer.name}<br/>
                        <strong>Skills:</strong> {selectedVolunteer.skills.join(', ')}<br/>
                        <strong>Availability:</strong> {selectedVolunteer.availability}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAssignTaskModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" className="bg-green-600 hover:bg-green-700">
                      Assign Task
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Volunteer Selection Modal for Quick Assign */}
          {showVolunteerSelectionModal && selectedNeed && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in">
              <div className="bg-white rounded-lg p-4 lg:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Select Volunteer for Assignment</h3>
                  <button 
                    onClick={() => setShowVolunteerSelectionModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ×
                  </button>
                </div>
                
                <div className="mb-4">
                  <div className="bg-blue-50 p-3 rounded-md">
                    <p className="text-sm text-blue-800">
                      <strong>Task:</strong> {selectedNeed.title}<br/>
                      <strong>Skill Required:</strong> {selectedNeed.skill}<br/>
                      <strong>Location:</strong> {selectedNeed.location}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm text-gray-600 font-medium">Available Volunteers:</p>
                  {volunteers.map((volunteer: any) => (
                    <div 
                      key={volunteer.id} 
                      className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleSelectVolunteerForAssignment(volunteer)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold mr-3 ${
                            volunteer.level === 'Champion' ? 'bg-orange-500' :
                            volunteer.level === 'Active' ? 'bg-purple-500' :
                            volunteer.level === 'Contributor' ? 'bg-blue-500' : 'bg-gray-500'
                          }`}>
                            {(volunteer.name || '').split(' ').map((n: string) => n[0]).join('') || 'V'}
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">{volunteer.name}</h4>
                            <p className="text-sm text-gray-500">{volunteer.city} • {volunteer.specialty}</p>
                            <div className="flex gap-2 mt-1">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                volunteer.level === 'Champion' ? 'bg-orange-100 text-orange-800' :
                                volunteer.level === 'Active' ? 'bg-purple-100 text-purple-800' :
                                volunteer.level === 'Contributor' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                                {volunteer.level}
                              </span>
                              <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                                {volunteer.availability}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button size="sm" className="bg-green-600 hover:bg-green-700">
                          Select
                        </Button>
                      </div>
                      
                      <div className="mt-3 flex flex-wrap gap-1">
                        {volunteer.skills.map((skill: string, index: number) => (
                          <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex justify-end">
                  <Button variant="outline" onClick={() => setShowVolunteerSelectionModal(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Assignment Details Modal */}
          {showAssignmentDetailsModal && selectedAssignment && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in">
              <div className="bg-white rounded-lg p-4 lg:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto lg:mx-4 modal-scale-in">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">Assignment Details</h3>
                  <button 
                    onClick={() => setShowAssignmentDetailsModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ×
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Volunteer</p>
                      <p className="font-medium text-gray-900">{selectedAssignment.volunteer}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Task</p>
                      <p className="font-medium text-gray-900">{selectedAssignment.need}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Status</p>
                      <p className="font-medium text-gray-900">{selectedAssignment.status}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Assigned Date</p>
                      <p className="font-medium text-gray-900">{selectedAssignment.assignedDate?.toDate?.()?.toLocaleDateString() || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Due Date</p>
                      <p className="font-medium text-gray-900">{selectedAssignment.dueDate?.toDate?.()?.toLocaleDateString() || selectedAssignment.dueDate || 'N/A'}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 pt-4 border-t border-gray-200">
                    <Button variant="outline" onClick={() => setShowAssignmentDetailsModal(false)}>
                      Close
                    </Button>
                    {selectedAssignment.status === 'Pending' && (
                      <Button className="bg-green-600 hover:bg-green-700">
                        Start Assignment
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Rating Modal */}
          {showRatingModal && selectedAssignment && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg p-4 lg:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Rate Volunteer</h3>
                  <button 
                    onClick={() => setShowRatingModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ×
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">{selectedAssignment.volunteer}</h4>
                    <p className="text-sm text-gray-600">Task: {selectedAssignment.need}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Rating (1-5 stars)</label>
                    <div className="flex items-center space-x-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setSelectedRating(star)}
                          className={`text-2xl transition-colors ${
                            star <= selectedRating ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-400'
                          }`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Feedback (optional)</label>
                    <textarea
                      value={ratingFeedback}
                      onChange={(e) => setRatingFeedback(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                      rows={3}
                      placeholder="Share feedback about the volunteer's performance..."
                    />
                  </div>
                  
                  <div className="flex gap-3 pt-4 border-t border-gray-200">
                    <Button 
                      onClick={async () => {
                        try {
                          
                          // Update assignment with rating in Firestore
                          const assignmentRef = doc(db, 'assignments', selectedAssignment.id);
                          await updateDoc(assignmentRef, {
                            rating: selectedRating,
                            feedback: ratingFeedback,
                            ratedDate: Timestamp.now()
                          });
                          
                          
                          // Find the volunteer and update their average rating in users collection
                          const volunteer = volunteers.find(v => v.name === selectedAssignment.volunteer);
                          if (volunteer) {
                            
                            // Calculate new average rating (simple implementation)
                            const currentRating = volunteer.averageRating || 0;
                            const newAverageRating = ((currentRating * (volunteer.ratingsCount || 0)) + selectedRating) / ((volunteer.ratingsCount || 0) + 1);
                            
                            const userRef = doc(db, 'users', volunteer.id);
                            await updateDoc(userRef, {
                              averageRating: newAverageRating,
                              ratingsCount: (volunteer.ratingsCount || 0) + 1,
                              // Update badge based on rating
                              badge: newAverageRating >= 4.5 ? 'Champion' :
                                     newAverageRating >= 3.5 ? 'Active' :
                                     newAverageRating >= 2.5 ? 'Contributor' : 'Newcomer'
                            });
                            
                            
                            // Update local state
                            volunteer.averageRating = newAverageRating;
                            volunteer.ratingsCount = (volunteer.ratingsCount || 0) + 1;
                            volunteer.badge = newAverageRating >= 4.5 ? 'Champion' :
                                           newAverageRating >= 3.5 ? 'Active' :
                                           newAverageRating >= 2.5 ? 'Contributor' : 'Newcomer';
                          }
                          
                          addNotification('Rating submitted successfully!', 'success');
                          setShowRatingModal(false);
                        } catch (error) {
                          console.error('❌ Rating error:', error);
                          addNotification('Failed to submit rating', 'error');
                        }
                      }}
                      className="bg-green-600 hover:bg-green-700 flex-1"
                    >
                      Submit Rating
                    </Button>
                    <Button variant="outline" onClick={() => setShowRatingModal(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notification System */}
          <NotificationUI 
            notifications={[]} 
            onRemove={() => {}} 
          />
        </main>

        {/* Notification System */}
        <NotificationUI 
          notifications={[]} 
          onRemove={() => {}} 
        />
      </div>
    </div>
  );
}
