import React, { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext();

const INITIAL_NEWS = [
  {
    id: 'news-1',
    title: 'Flash Flood Warning: Heavy Rainfall Forecast in Northern & Eastern Dhaka',
    category: 'High Alert',
    severity: 'critical', // 'critical' | 'warning' | 'info'
    region: 'Eastern Suburbs (Badda, Demra, Khilgaon)',
    summary: 'Water Development Board recorded continuous 85mm rainfall over the past 4 hours. Low-lying areas are advised to prepare for water levels rising 2-3 feet.',
    publishedAt: '12 mins ago',
    author: 'Disaster Management Wing',
    verified: true
  },
  {
    id: 'news-2',
    title: 'Buriganga River Level Approaching 30cm Below Danger Mark at Mill Barrack',
    category: 'River Monitoring',
    severity: 'warning',
    region: 'Old Dhaka & Keraniganj Basin',
    summary: 'Sluice gates along the southern embankment have been put on 24-hour manned supervision. Small water crafts restricted until further notice.',
    publishedAt: '1 hour ago',
    author: 'Flood Forecasting & Warning Center (FFWC)',
    verified: true
  },
  {
    id: 'news-3',
    title: 'Designated Cyclone & Flood Emergency Shelters Activated Across Zone 5',
    category: 'Public Advisory',
    severity: 'info',
    region: 'Zone 5 & Zone 7 Municipal Centers',
    summary: '14 primary school buildings and community centers are now stocked with drinking water, dry rations, and medical kits.',
    publishedAt: '3 hours ago',
    author: 'Dhaka Emergency Relief Division',
    verified: true
  }
];

const INITIAL_RESCUE_REQUESTS = [
  {
    id: 'sos-101',
    callerName: 'Tanvir Hossain',
    phone: '01712-449821',
    location: 'Badda, Block D, Road 7, House 14',
    coordinates: '23.7806° N, 90.4267° E',
    floodDepth: '4.2 feet',
    peopleTrapped: 4,
    vulnerable: '1 infant, 1 elderly cardiac patient',
    status: 'urgent', // 'urgent' | 'dispatched' | 'rescued'
    assignedTeam: 'Rescue Unit 4 (Inflatable Boat A-2)',
    timestamp: '8 mins ago',
    notes: 'Ground floor submerged. Trapped on 1st-floor balcony.'
  },
  {
    id: 'sos-102',
    callerName: 'Nasima Begum',
    phone: '01891-332109',
    location: 'Demra Sharulia, Ghat #3 area',
    coordinates: '23.7121° N, 90.4932° E',
    floodDepth: '3.5 feet',
    peopleTrapped: 6,
    vulnerable: 'Family with 2 children',
    status: 'dispatched',
    assignedTeam: 'Civil Defense Team Bravo',
    timestamp: '25 mins ago',
    notes: 'Power lines down nearby. Approaching with motorized dinghy.'
  },
  {
    id: 'sos-103',
    callerName: 'Abdul Malek',
    phone: '01911-889922',
    location: 'Merul Badda, Near DIT Canal',
    coordinates: '23.7692° N, 90.4211° E',
    floodDepth: '2.8 feet',
    peopleTrapped: 2,
    vulnerable: 'Elderly couple',
    status: 'rescued',
    assignedTeam: 'Red Crescent Volunteer Unit 1',
    timestamp: '1 hour ago',
    notes: 'Safely evacuated to Badda High School emergency shelter.'
  }
];

const INITIAL_CITIZEN_REPORTS = [
  {
    id: 'rep-201',
    reporter: 'Siddiqur Rahman',
    location: 'Rampura Bridge approach road',
    waterDepth: '1.8 ft',
    description: 'Severe waterlogging, small vehicles cannot pass. Drainage canal blocked by debris.',
    status: 'pending_validation', // 'pending_validation' | 'verified' | 'rejected'
    time: '15 mins ago'
  },
  {
    id: 'rep-202',
    reporter: 'Farhana Yasmin',
    location: 'Kazipara Bus Stand, Mirpur',
    waterDepth: '2.5 ft',
    description: 'Road inundated up to knee level. Manhole covers missing, hazard for pedestrians.',
    status: 'pending_validation',
    time: '35 mins ago'
  }
];

export const PRESET_USERS = {
  citizen: {
    email: 'citizen@rokkha.org',
    role: 'citizen',
    name: 'Rahim Ahmed',
    title: 'Resident, Eastern Dhaka',
    badge: 'Verified Citizen',
    avatar: 'RA'
  },
  rescue_team: {
    email: 'rescue@rokkha.org',
    role: 'rescue_team',
    name: 'Capt. Farhan Chowdhury',
    title: 'Field Operations Commander, Unit 7',
    badge: 'Emergency Response Squad',
    avatar: 'FC'
  },
  admin: {
    email: 'admin@rokkha.org',
    role: 'admin',
    name: 'Dr. Nasreen Sultana',
    title: 'Director of Flood Monitoring & Early Warning',
    badge: 'Disaster System Admin',
    avatar: 'NS'
  }
};

export function AppProvider({ children }) {
  // Current user: null means guest/public visitor
  const [currentUser, setCurrentUser] = useState(null);
  const [news, setNews] = useState(INITIAL_NEWS);
  const [rescueRequests, setRescueRequests] = useState(INITIAL_RESCUE_REQUESTS);
  const [citizenReports, setCitizenReports] = useState(INITIAL_CITIZEN_REPORTS);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Fast Login Helper
  const fastLogin = (roleKey) => {
    if (roleKey === 'guest') {
      setCurrentUser(null);
      return null;
    }
    const user = PRESET_USERS[roleKey];
    if (user) {
      setCurrentUser(user);
      return user;
    }
    return null;
  };

  const logout = () => {
    setCurrentUser(null);
  };

  // Add news (admin)
  const addNews = (newsItem) => {
    const newItem = {
      id: `news-${Date.now()}`,
      publishedAt: 'Just now',
      verified: true,
      author: currentUser?.name || 'Authorized Admin',
      ...newsItem
    };
    setNews([newItem, ...news]);
  };

  // Delete news (admin)
  const deleteNews = (id) => {
    setNews(news.filter(n => n.id !== id));
  };

  // Update SOS status (rescue team)
  const updateRescueStatus = (id, newStatus, assignedTeam) => {
    setRescueRequests(rescueRequests.map(req => {
      if (req.id === id) {
        return {
          ...req,
          status: newStatus,
          assignedTeam: assignedTeam || req.assignedTeam
        };
      }
      return req;
    }));
  };

  // Add SOS request (citizen or public)
  const submitSosRequest = (requestData) => {
    const newReq = {
      id: `sos-${Date.now()}`,
      status: 'urgent',
      timestamp: 'Just now',
      assignedTeam: 'Pending Dispatch',
      ...requestData
    };
    setRescueRequests([newReq, ...rescueRequests]);
    return newReq;
  };

  // Add citizen report (citizen or public)
  const submitCitizenReport = (reportData) => {
    const newReport = {
      id: `rep-${Date.now()}`,
      status: 'pending_validation',
      time: 'Just now',
      ...reportData
    };
    setCitizenReports([newReport, ...citizenReports]);
    return newReport;
  };

  // Validate or reject report (admin)
  const validateCitizenReport = (id, action) => {
    setCitizenReports(citizenReports.map(rep => {
      if (rep.id === id) {
        return { ...rep, status: action === 'verify' ? 'verified' : 'rejected' };
      }
      return rep;
    }));

    // If verified by admin, optionally publish as flood news automatically
    if (action === 'verify') {
      const rep = citizenReports.find(r => r.id === id);
      if (rep) {
        addNews({
          title: `Verified Waterlogging: ${rep.location} (${rep.waterDepth})`,
          category: 'Citizen Field Report',
          severity: 'warning',
          region: rep.location,
          summary: `${rep.description} - Verified by Disaster Monitoring Admin.`,
        });
      }
    }
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        fastLogin,
        logout,
        authModalOpen,
        setAuthModalOpen,
        news,
        addNews,
        deleteNews,
        rescueRequests,
        updateRescueStatus,
        submitSosRequest,
        citizenReports,
        submitCitizenReport,
        validateCitizenReport
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

