import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare, Send, Phone, CheckCheck, Check, X, Clock, Bot, User,
  Settings, LogOut, Search, Plus, RefreshCw, Star, Info
} from 'lucide-react';
import type { Contact, Message, ApiStatus, Stats, ApiConfig, ConnectionStatus } from './types';
import { generateGeminiReply, hasGeminiApiKey, openGeminiApiKeySelection } from './services/geminiService';

// Utility to generate dynamic mock data for 'live' connection simulation
const generateLiveMockData = (): { contacts: Contact[], messages: Message[] } => {
  const now = Date.now();
  const contacts: Contact[] = [
    { id: 101, name: 'Alice Johnson', phone: '+1122334455', lastMessage: 'Hey, is the store open?', lastMessageTime: new Date(now - 120000), unread: 1, avatar: 'AJ' },
    { id: 102, name: 'Bob Williams', phone: '+9988776655', lastMessage: 'Got it, thanks!', lastMessageTime: new Date(now - 300000), unread: 0, avatar: 'BW' },
    { id: 103, name: 'Charlie Brown', phone: '+5544332211', lastMessage: 'Can I change my order?', lastMessageTime: new Date(now - 60000), unread: 3, avatar: 'CB' },
    { id: 104, name: 'Diana Prince', phone: '+7788990011', lastMessage: 'Awesome!', lastMessageTime: new Date(now - 900000), unread: 0, avatar: 'DP' },
    { id: 105, name: 'Eve Davis', phone: '+3322110099', lastMessage: 'Need help with login.', lastMessageTime: new Date(now - 180000), unread: 2, avatar: 'ED' },
  ];

  const messages: Message[] = [
    { id: 1001, contactId: 101, sender: 'customer', content: 'Hey, is the store open?', type: 'text', timestamp: new Date(now - 120000), status: 'read', isBot: false },
    { id: 1002, contactId: 101, sender: 'agent', content: 'Yes, we are open until 6 PM today!', type: 'text', timestamp: new Date(now - 100000), status: 'read', isBot: true },
    { id: 1003, contactId: 103, sender: 'customer', content: 'Hi, can I change my order from yesterday?', type: 'text', timestamp: new Date(now - 60000), status: 'delivered', isBot: false },
    { id: 1004, contactId: 103, sender: 'agent', content: 'Certainly! What is your order number?', type: 'text', timestamp: new Date(now - 50000), status: 'sent', isBot: true },
    { id: 1005, contactId: 105, sender: 'customer', content: 'I forgot my password, can you help?', type: 'text', timestamp: new Date(now - 180000), status: 'delivered', isBot: false },
    { id: 1006, contactId: 105, sender: 'agent', content: 'No problem! Please click the "Forgot Password" link on the login page.', type: 'text', timestamp: new Date(now - 170000), status: 'sent', isBot: true },
  ];

  return { contacts, messages };
};

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [apiStatus, setApiStatus] = useState<ApiStatus>({
    phoneNumber: 'Not Connected',
    online: false,
    webhookConnected: false,
    apiConnected: false,
    lastSync: new Date()
  });
  const [stats, setStats] = useState<Stats>({
    totalMessages: 0,
    unreadMessages: 0,
    botReplies: 0,
    manualReplies: 0
  });
  const [loginForm, setLoginForm] = useState({ otp: '' });
  const [apiConfig, setApiConfig] = useState<ApiConfig>({
    phoneNumberId: '',
    businessAccountId: '',
    apiToken: '',
    webhookUrl: '', // Default to empty
    n8nWebhookUrl: '', // Default to empty
    verifyToken: 'your_verify_token_123',
    backendApiUrl: '', // New: Initialize empty
  });
  const [configSaved, setConfigSaved] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    whatsapp: false,
    webhook: false,
    n8n: false,
    backendApi: false, // New: Initialize false
  });
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [isWhatsAppConnected, setIsWhatsAppConnected] = useState(false); // New state for WhatsApp connection status
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize mock data for a connected state
  const initializeConnectedMockData = useCallback(() => {
    const { contacts: liveContacts, messages: liveMessages } = generateLiveMockData();
    setContacts(liveContacts);
    setMessages(liveMessages);
    setStats({
      totalMessages: liveMessages.length,
      unreadMessages: liveContacts.reduce((sum, c) => sum + c.unread, 0),
      botReplies: liveMessages.filter(m => m.sender === 'agent' && m.isBot).length,
      manualReplies: liveMessages.filter(m => m.sender === 'agent' && !m.isBot).length
    });
  }, []);

  // Simulate new incoming messages
  const simulateNewMessage = useCallback(() => {
    if (contacts.length === 0 || !isAuthenticated || !isWhatsAppConnected) return;

    const randomContact = contacts[Math.floor(Math.random() * contacts.length)];
    if (randomContact) {
      const newMsg: Message = {
        id: Date.now(),
        contactId: randomContact.id,
        sender: 'customer',
        content: `New message from ${randomContact.name} - ${new Date().toLocaleTimeString()}`,
        type: 'text',
        timestamp: new Date(),
        status: 'delivered',
        isBot: false
      };
      setMessages(prev => [...prev, newMsg]);
      setContacts(prev => prev.map(c =>
        c.id === randomContact.id
          ? { ...c, lastMessage: newMsg.content, lastMessageTime: newMsg.timestamp, unread: c.unread + 1 }
          : c
      ));
      setStats(prev => ({ ...prev, totalMessages: prev.totalMessages + 1, unreadMessages: prev.unreadMessages + 1 }));
    }
  }, [contacts, isAuthenticated, isWhatsAppConnected]);

  // Scroll to bottom of chat messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Effect for initial setup and loading saved config
  useEffect(() => {
    if (isAuthenticated) {
      // Check Gemini API key status on login
      hasGeminiApiKey().then(setHasGeminiKey);

      // Try to load saved configuration
      try {
        const savedConfig = localStorage.getItem('whatsapp_config');
        if (savedConfig) {
          const config = JSON.parse(savedConfig);
          setApiConfig(config);
          setConfigSaved(true);
          setApiStatus(prev => ({
            ...prev,
            phoneNumber: config.phoneNumberId || 'Not Connected'
          }));
          // NOTE: isWhatsAppConnected remains false here. User must explicitly click "Connect WhatsApp".
        }
      } catch (error) {
        console.error('Error loading config from localStorage:', error);
      }
      // Initially, clear contacts/messages until WhatsApp is explicitly connected
      setContacts([]);
      setMessages([]);
      setSelectedContact(null);

    } else {
      // Clear all relevant states on logout
      setContacts([]);
      setMessages([]);
      setStats({ totalMessages: 0, unreadMessages: 0, botReplies: 0, manualReplies: 0 });
      setSelectedContact(null);
      setApiStatus({
        phoneNumber: 'Not Connected', online: false, webhookConnected: false, apiConnected: false, lastSync: new Date()
      });
      setIsWhatsAppConnected(false); // Reset WhatsApp connection state
      setConfigSaved(false); // Reset config saved state too
      setConnectionStatus({ whatsapp: false, webhook: false, n8n: false, backendApi: false }); // Reset backendApi status
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Effect for message simulation (dependent on isWhatsAppConnected)
  useEffect(() => {
    let messageInterval: number | undefined;
    if (isAuthenticated && isWhatsAppConnected) {
      messageInterval = setInterval(simulateNewMessage, 15000); // Every 15 seconds
    } else {
      if (messageInterval) clearInterval(messageInterval);
    }
    return () => {
      if (messageInterval) clearInterval(messageInterval);
    };
  }, [isAuthenticated, isWhatsAppConnected, simulateNewMessage]);

  // Effect for scrolling to bottom when messages or selected contact changes
  useEffect(() => {
    scrollToBottom();
  }, [messages, selectedContact, scrollToBottom]);

  // Handle Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginForm.otp === '1234' || loginForm.otp.length >= 4) { // Simple mock authentication
      setIsAuthenticated(true);
    } else {
      alert('Invalid OTP. Please try again with 1234.');
    }
  };

  // Handle sending a new message
  const handleSendMessage = async (isGeminiResponse = false, geminiContent: string = '') => {
    if (!newMessage.trim() && !isGeminiResponse || !selectedContact) return;

    const messageContent = isGeminiResponse ? geminiContent : newMessage;

    const newMsg: Message = {
      id: Date.now(),
      contactId: selectedContact.id,
      sender: 'agent',
      content: messageContent,
      type: 'text',
      timestamp: new Date(),
      status: 'sent',
      isBot: isGeminiResponse,
      prompt: isGeminiResponse ? 'Gemini AI Response' : undefined
    };

    setMessages(prev => [...prev, newMsg]);
    setContacts(prev => prev.map(c =>
      c.id === selectedContact.id
        ? { ...c, lastMessage: newMsg.content, lastMessageTime: newMsg.timestamp, unread: 0 }
        : c
    ));
    setStats(prev => ({
      ...prev,
      totalMessages: prev.totalMessages + 1,
      [isGeminiResponse ? 'botReplies' : 'manualReplies']: (isGeminiResponse ? prev.botReplies : prev.manualReplies) + 1
    }));
    setNewMessage('');

    // Simulate message status updates
    setTimeout(() => {
      setMessages(prev => prev.map(m =>
        m.id === newMsg.id ? { ...m, status: 'delivered' } : m
      ));
    }, 1000);

    setTimeout(() => {
      setMessages(prev => prev.map(m =>
        m.id === newMsg.id ? { ...m, status: 'read' } : m
      ));
    }, 2000);
  };

  // Handle saving API configuration
  const handleSaveConfig = () => {
    if (!apiConfig.phoneNumberId || !apiConfig.businessAccountId || !apiConfig.apiToken) {
      alert('❌ Please fill all required fields (Phone Number ID, Business Account ID, and API Token)');
      return;
    }

    try {
      const configToSave = {
        ...apiConfig,
        savedAt: new Date().toISOString()
      };

      localStorage.setItem('whatsapp_config', JSON.stringify(configToSave));
      setConfigSaved(true);

      setApiStatus(prev => ({
        ...prev,
        phoneNumber: apiConfig.phoneNumberId,
        lastSync: new Date()
      }));

      alert('✅ Configuration saved successfully!\n\n🔔 Next Steps:\n1. Configure webhook in Meta Business Suite\n2. Click "Connect WhatsApp" button to verify connection\n3. Test your webhook URLs');
    } catch (error: any) {
      alert('❌ Error saving configuration: ' + error.message);
    }
  };

  // Handle connecting to WhatsApp API (Facebook Graph API)
  const handleConnectWhatsApp = async () => {
    if (!apiConfig.phoneNumberId || !apiConfig.apiToken) {
      alert('❌ Please save your API configuration first!');
      return;
    }

    setIsConnecting(true);
    setConnectionStatus(prev => ({ ...prev, whatsapp: false })); // Reset status
    setIsWhatsAppConnected(false); // Reset WhatsApp connected state
    setContacts([]); // Clear contacts before attempting connection
    setMessages([]); // Clear messages before attempting connection

    try {
      // Using Facebook Graph API v19.0 (latest stable at time of writing)
      const graphApiUrl = `https://graph.facebook.com/v19.0/${apiConfig.phoneNumberId}`;
      const response = await fetch(
        graphApiUrl,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiConfig.apiToken}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setConnectionStatus(prev => ({ ...prev, whatsapp: true }));
        setApiStatus(prev => ({
          ...prev,
          online: true,
          apiConnected: true,
          phoneNumber: data.display_phone_number || apiConfig.phoneNumberId,
          lastSync: new Date()
        }));
        setIsWhatsAppConnected(true); // Set true on successful connection
        initializeConnectedMockData(); // Load "live" mock data
        alert('✅ WhatsApp API Connected Successfully!\n\nPhone: ' + (data.display_phone_number || apiConfig.phoneNumberId) + '\n\nSimulated live chat data loaded! For actual live chats, a backend is required to handle webhooks and secure your API token.');
      } else {
        const error = await response.json();
        setConnectionStatus(prev => ({ ...prev, whatsapp: false }));
        setApiStatus(prev => ({ ...prev, apiConnected: false, online: false }));
        setIsWhatsAppConnected(false); // Ensure false on failure
        alert('❌ Failed to connect to WhatsApp API\n\nError: ' + (error.error?.message || 'Invalid credentials or permissions.'));
      }
    } catch (error: any) {
      setConnectionStatus(prev => ({ ...prev, whatsapp: false }));
      setApiStatus(prev => ({ ...prev, apiConnected: false, online: false }));
      setIsWhatsAppConnected(false); // Ensure false on failure
      alert('❌ Connection Error: ' + error.message + '\n\nPlease check:\n• API Token is valid and has permissions\n• Phone Number ID is correct\n• Internet connection');
    } finally {
      setIsConnecting(false);
    }
  };

  // Handle loading saved configuration
  const handleLoadConfig = () => {
    try {
      const savedConfig = localStorage.getItem('whatsapp_config');
      if (savedConfig) {
        const config = JSON.parse(savedConfig);
        setApiConfig(config);
        setConfigSaved(true);
        setApiStatus(prev => ({
          ...prev,
          phoneNumber: config.phoneNumberId || 'Not Connected',
          lastSync: new Date()
        }));
        alert('✅ Configuration loaded from previous save!');
      } else {
        alert('ℹ️ No saved configuration found');
      }
    } catch (error: any) {
      alert('❌ Error loading configuration: ' + error.message);
    }
  };

  // Handle testing generic webhook URL
  const handleTestWebhook = async () => {
    if (!apiConfig.webhookUrl) {
      alert('Please enter a Webhook URL first!');
      return;
    }
    setConnectionStatus(prev => ({ ...prev, webhook: false }));
    try {
      const response = await fetch(apiConfig.webhookUrl, {
        method: 'GET', // A simple GET usually suffices for reachability
        mode: 'cors', // Ensure CORS mode for potential external endpoints
      });

      if (response.ok) {
        setConnectionStatus(prev => ({ ...prev, webhook: true }));
        alert('✅ Webhook URL is reachable! Status: ' + response.status + '.\n\nNote: A successful reachability test does not guarantee correct webhook payload processing.');
      } else {
        setConnectionStatus(prev => ({ ...prev, webhook: false }));
        alert('⚠️ Webhook URL returned an error. Status: ' + response.status + '.\n\nPlease check the URL and your webhook endpoint logic. If this is a backend you control, ensure it returns a 2xx status for GET requests (for verification).');
      }
    } catch (error: any) {
      console.error('Error testing Webhook URL:', error); // Log to console
      setConnectionStatus(prev => ({ ...prev, webhook: false }));
      alert('❌ Could not reach Webhook URL. Error: ' + (error.message || 'Unknown network error') + '\n\nPlease check:\n• The URL is correct.\n• Your server is running and publicly accessible.\n• Cross-Origin Resource Sharing (CORS) headers are configured on your webhook endpoint to allow requests from this dashboard\'s domain.');
    }
  };

  // Handle testing n8n webhook (for AI agent responses)
  const handleTestN8nWebhook = async () => {
    if (!apiConfig.n8nWebhookUrl) {
      alert('Please enter an n8n Webhook URL first!');
      return;
    }
    setConnectionStatus(prev => ({ ...prev, n8n: false }));
    try {
      const testData = {
        test: true,
        message: 'Test message from WhatsApp Dashboard to n8n',
        timestamp: new Date().toISOString()
      };

      const response = await fetch(apiConfig.n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json', // Suggest JSON response
        },
        body: JSON.stringify(testData),
        mode: 'cors', // Ensure CORS mode
      });

      if (response.ok) {
        setConnectionStatus(prev => ({ ...prev, n8n: true }));
        alert('✅ n8n Webhook is working! Check your n8n workflow for the test message. Status: ' + response.status + '.\n\nNote: A successful test means the message was sent, verify within n8n that the workflow processed it as expected.');
      } else {
        setConnectionStatus(prev => ({ ...prev, n8n: false }));
        alert('⚠️ n8n Webhook returned an error. Status: ' + response.status + '. Please check your n8n workflow for errors or misconfigurations (e.g., incorrect HTTP method, authentication issues).');
      }
    } catch (error: any) {
      console.error('Error testing n8n Webhook URL:', error); // Log to console
      setConnectionStatus(prev => ({ ...prev, n8n: false }));
      alert('❌ Could not reach n8n webhook. Error: ' + (error.message || 'Unknown network error') + '\n\nPlease check:\n• The URL is correct.\n• Your n8n instance is running and the workflow is active.\n• Cross-Origin Resource Sharing (CORS) headers are configured on your n8n instance if it is running on a different domain.');
    }
  };

  // Handle testing custom backend API URL
  const handleTestBackendApi = async () => {
    if (!apiConfig.backendApiUrl) {
      alert('Please enter your Backend API URL first!');
      return;
    }
    setConnectionStatus(prev => ({ ...prev, backendApi: false }));
    try {
      // Perform a simple GET request to a known health check endpoint on the backend
      const healthCheckUrl = `${apiConfig.backendApiUrl.endsWith('/') ? apiConfig.backendApiUrl : apiConfig.backendApiUrl + '/'}health`;
      const response = await fetch(healthCheckUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        mode: 'cors', // Ensure CORS mode
      });

      if (response.ok) {
        setConnectionStatus(prev => ({ ...prev, backendApi: true }));
        alert('✅ Backend API URL is reachable! Status: ' + response.status + '.\n\nChecked ' + healthCheckUrl + '.');
      } else {
        setConnectionStatus(prev => ({ ...prev, backendApi: false }));
        alert('⚠️ Backend API URL returned an error or health check failed. Status: ' + response.status + '.\n\nPlease ensure your backend is running, the URL is correct, and that a `/health` endpoint exists and returns a 2xx status. If the `/health` endpoint is different, adjust the test URL. Also check backend CORS configuration.');
      }
    } catch (error: any) {
      console.error('Error testing Backend API URL:', error); // Log to console
      setConnectionStatus(prev => ({ ...prev, backendApi: false }));
      alert('❌ Could not reach Backend API URL. Error: ' + (error.message || 'Unknown network error') + '\n\nPlease check:\n• The URL is correct.\n• Your backend server is running and accessible from the internet.\n• Cross-Origin Resource Sharing (CORS) headers are configured on your backend to allow requests from this dashboard\'s domain.');
    }
  };

  // Function to prompt for Gemini API key
  const promptForGeminiApiKey = async () => {
    await openGeminiApiKeySelection();
    setHasGeminiKey(await hasGeminiApiKey()); // Update state after selection attempt
  };

  // Handle generating a Gemini AI reply
  const handleGenerateGeminiReply = async () => {
    if (!selectedContact) {
      alert('Please select a contact to generate an AI reply.');
      return;
    }
    if (!hasGeminiKey) {
      alert('Gemini API Key not selected. Please select your API key first.');
      await promptForGeminiApiKey(); // Prompt to select key if not available
      return;
    }

    const lastCustomerMessage = messages
      .filter(m => m.contactId === selectedContact.id && m.sender === 'customer')
      .slice(-1)[0];

    const prompt = lastCustomerMessage
      ? `You are a helpful customer service agent. The customer, ${selectedContact.name}, said: "${lastCustomerMessage.content}". Please provide a concise and helpful response. Keep it under 50 words.`
      : `You are a helpful customer service agent. Generate an initial greeting for ${selectedContact.name}. Keep it under 30 words.`;

    try {
      const reply = await generateGeminiReply(prompt);
      if (reply) {
        await handleSendMessage(true, reply); // Send as an AI-generated message
      } else {
        alert('Gemini AI could not generate a reply.');
      }
    } catch (error) {
      console.error('Failed to get Gemini AI reply:', error);
      alert('Failed to get Gemini AI reply. Check console for details. Ensure your API key is valid and has billing enabled. Link to billing: ai.google.dev/gemini-api/docs/billing');
      // If error suggests invalid key, trigger key selection again
      if ((error as Error).message.includes("Requested entity was not found.")) {
        setHasGeminiKey(false);
      }
    }
  };

  // Get status icon for messages
  const getStatusIcon = (status: Message['status']) => {
    switch (status) {
      case 'sent': return <Check className="w-3 h-3 text-gray-400" />;
      case 'delivered': return <CheckCheck className="w-3 h-3 text-gray-400" />;
      case 'read': return <CheckCheck className="w-3 h-3 text-blue-500" />;
      case 'failed': return <X className="w-3 h-3 text-red-500" />;
      default: return <Clock className="w-3 h-3 text-gray-400" />;
    }
  };

  // Format time for display
  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime(); // Use getTime() for millisecond comparison
    if (diff < 86400000) { // Less than 24 hours
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Filter contacts based on search query
  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  );

  // Get messages for the selected contact
  const selectedContactMessages = selectedContact
    ? messages.filter(m => m.contactId === selectedContact.id)
    : [];

  // Authentication UI
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="bg-green-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">WhatsApp Gemini Agent</h1>
            <p className="text-gray-600 mt-2">Enter OTP to continue</p>
          </div>
          <form onSubmit={handleLogin}>
            <input
              type="text"
              placeholder="Enter OTP (use 1234)"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              value={loginForm.otp}
              onChange={(e) => setLoginForm({ ...loginForm, otp: e.target.value })}
            />
            <button
              type="submit"
              className="w-full bg-green-500 text-white py-3 rounded-lg font-semibold hover:bg-green-600 transition"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-green-700 text-white p-4 shadow-lg">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <MessageSquare className="w-8 h-8" />
            <div>
              <h1 className="text-xl font-bold">WhatsApp Gemini Agent</h1>
              <p className="text-xs text-green-100">AI-Powered Customer Support</p>
            </div>
          </div>
          <button
            onClick={() => setIsAuthenticated(false)}
            className="flex items-center space-x-2 bg-green-800 px-4 py-2 rounded-lg hover:bg-green-900 transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto flex space-x-1 sm:space-x-4 overflow-x-auto">
          {['dashboard', 'chat', 'logs', 'settings'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-shrink-0 px-4 sm:px-6 py-3 font-medium capitalize transition whitespace-nowrap ${
                activeTab === tab
                  ? 'text-green-700 border-b-2 border-green-700'
                  : 'text-gray-600 hover:text-green-700'
              }`}
            >
              {tab === 'chat' ? (
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> Chat
                </div>
              ) : tab === 'dashboard' ? (
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4" /> Dashboard
                </div>
              ) : tab === 'logs' ? (
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4" /> Logs
                </div>
              ) : tab === 'settings' ? (
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4" /> Settings
                </div>
              ) : (
                tab
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 container mx-auto p-4 md:p-6 lg:p-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* API Status Card */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                <h2 className="text-xl font-bold flex items-center text-gray-800">
                  <Phone className="w-5 h-5 mr-2 text-green-700" />
                  WhatsApp API Status
                </h2>
                <button
                  onClick={handleConnectWhatsApp}
                  disabled={isConnecting || !configSaved}
                  className={`px-4 py-2 rounded-lg font-semibold transition flex items-center space-x-2 ${
                    configSaved
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <RefreshCw className={`w-4 h-4 ${isConnecting ? 'animate-spin' : ''}`} />
                  <span>{isConnecting ? 'Connecting...' : 'Connect WhatsApp'}</span>
                </button>
              </div>

              {!configSaved && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠️ Please configure and save your API settings in the <strong>Settings</strong> tab first.
                  </p>
                </div>
              )}
              
              {!isWhatsAppConnected && configSaved && !isConnecting && (
                 <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                   <p className="text-sm text-blue-800">
                     Click "Connect WhatsApp" above to load <span className="font-semibold">simulated</span> live chats.
                   </p>
                 </div>
               )}

              {isWhatsAppConnected && (
                 <div className="mb-4 p-3 bg-blue-100 border border-blue-400 rounded-lg flex items-start space-x-3">
                   <Info className="w-5 h-5 text-blue-700 flex-shrink-0" />
                   <div>
                     <p className="text-sm text-blue-800 font-semibold">
                       Note: Displayed chats are simulated.
                     </p>
                     <p className="text-xs text-blue-700 mt-1">
                       For <span className="font-bold">actual live WhatsApp conversations</span> (fetching history & receiving real-time messages), a <span className="font-bold">backend server is required</span> to securely handle Meta webhooks and API token.
                       This frontend demonstrates the UI/UX.
                     </p>
                   </div>
                 </div>
               )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-gray-600">Phone Number</p>
                  <p className="text-lg font-bold text-green-800">{apiStatus.phoneNumber}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-gray-600">API Status</p>
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${apiStatus.apiConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                    <p className="text-lg font-bold">{apiStatus.apiConnected ? 'Connected' : 'Disconnected'}</p>
                  </div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-gray-600">Webhook</p>
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${connectionStatus.webhook ? 'bg-green-500' : 'bg-orange-500'}`} />
                    <p className="text-lg font-bold">{connectionStatus.webhook ? 'Active' : 'Pending'}</p>
                  </div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-gray-600">Last Sync</p>
                  <p className="text-lg font-bold">{formatTime(apiStatus.lastSync)}</p>
                </div>
              </div>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow-md p-6 text-center">
                <p className="text-gray-600 text-sm">Total Messages</p>
                <p className="text-4xl font-extrabold text-gray-800 mt-2">{stats.totalMessages}</p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6 text-center">
                <p className="text-gray-600 text-sm">Unread Messages</p>
                <p className="text-4xl font-extrabold text-orange-600 mt-2">{stats.unreadMessages}</p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6 text-center">
                <p className="text-gray-600 text-sm">Bot Replies</p>
                <p className="text-4xl font-extrabold text-blue-600 mt-2">{stats.botReplies}</p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6 text-center">
                <p className="text-gray-600 text-sm">Manual Replies</p>
                <p className="text-4xl font-extrabold text-green-600 mt-2">{stats.manualReplies}</p>
              </div>
            </div>

            {/* Recent Messages */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4 text-gray-800">Live Incoming Messages</h2>
              <div className="space-y-3">
                {!isWhatsAppConnected && (
                  <p className="text-center text-gray-500 py-4">Connect WhatsApp to see simulated live incoming messages.</p>
                )}
                {isWhatsAppConnected && messages.filter(m => m.sender === 'customer').slice(-5).reverse().map(msg => {
                  const contact = contacts.find(c => c.id === msg.contactId);
                  return (
                    <div key={msg.id} className="flex items-start space-x-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition">
                      <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                        {contact?.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-gray-800 truncate">{contact?.name || 'Unknown'}</p>
                            <p className="text-sm text-gray-600 truncate">{contact?.phone || 'N/A'}</p>
                          </div>
                          <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{formatTime(msg.timestamp)}</span>
                        </div>
                        <p className="text-gray-700 mt-1 line-clamp-2">{msg.content}</p>
                        <div className="flex items-center space-x-2 mt-2">
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">{msg.type}</span>
                          {getStatusIcon(msg.status)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {isWhatsAppConnected && messages.filter(m => m.sender === 'customer').length === 0 && (
                  <p className="text-center text-gray-500 py-4">No incoming messages yet.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="flex flex-col md:flex-row h-[calc(100vh-220px)] bg-white rounded-lg shadow-md overflow-hidden">
            {/* Contact List */}
            <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r flex flex-col">
              <div className="p-4 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search contacts..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {!isWhatsAppConnected && (
                  <div className="text-center text-gray-500 py-4 px-2">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium text-sm">WhatsApp not connected.</p>
                    <p className="text-xs">Go to Dashboard and click "Connect WhatsApp" to load simulated chats.</p>
                  </div>
                )}
                {isWhatsAppConnected && filteredContacts.length === 0 && (
                  <p className="text-center text-gray-500 py-4">No contacts found.</p>
                )}
                {isWhatsAppConnected && filteredContacts.map(contact => (
                  <div
                    key={contact.id}
                    onClick={() => setSelectedContact(contact)}
                    className={`p-4 cursor-pointer hover:bg-gray-100 border-b flex items-center space-x-3 transition ${
                      selectedContact?.id === contact.id ? 'bg-green-50 border-l-4 border-green-600' : ''
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-lg flex-shrink-0">
                      {contact.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <p className="font-semibold text-gray-800 truncate">{contact.name}</p>
                        <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{formatTime(contact.lastMessageTime)}</span>
                      </div>
                      <p className="text-sm text-gray-600 truncate">{contact.lastMessage}</p>
                    </div>
                    {contact.unread > 0 && (
                      <div className="bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 ml-2">
                        {contact.unread}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col">
              {selectedContact ? (
                <>
                  {/* Chat Header */}
                  <div className="p-4 border-b flex items-center space-x-3 bg-green-50 shadow-sm flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-base">
                      {selectedContact.avatar}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{selectedContact.name}</p>
                      <p className="text-sm text-gray-600">{selectedContact.phone}</p>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 custom-scrollbar">
                    {selectedContactMessages.length === 0 && (
                      <p className="text-center text-gray-500 py-4">No messages in this chat yet.</p>
                    )}
                    {selectedContactMessages.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender === 'agent' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[80%] lg:max-w-[60%] px-4 py-2 rounded-xl shadow-sm relative group ${
                          msg.sender === 'agent'
                            ? 'bg-green-600 text-white rounded-br-none'
                            : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
                        }`}>
                          {msg.isBot && (
                            <div className="flex items-center space-x-1 mb-1 text-xs opacity-80 font-medium">
                              <Bot className="w-3 h-3 text-white" />
                              <span className="text-gray-200">Bot Reply</span>
                            </div>
                          )}
                          <p className="text-sm leading-relaxed">{msg.content}</p>
                          <div className={`absolute bottom-0 right-0 p-1 flex items-center space-x-1 text-xs opacity-75 ${msg.sender === 'agent' ? 'text-white' : 'text-gray-500'}`}>
                            <span>{formatTime(msg.timestamp)}</span>
                            {msg.sender === 'agent' && getStatusIcon(msg.status)}
                          </div>
                          {/* Triangle for message bubble */}
                          <div className={`absolute ${msg.sender === 'agent' ? 'bottom-0 -right-2' : 'bottom-0 -left-2'} w-0 h-0 border-transparent border-t-[8px] border-l-[8px] ${msg.sender === 'agent' ? 'border-t-green-600' : 'border-t-white'} ${msg.sender === 'agent' ? '' : 'border-r-[8px]'}`} />
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input */}
                  <div className="p-4 border-t bg-white flex-shrink-0">
                    <div className="flex flex-col space-y-3">
                      {/* Gemini AI Reply button */}
                      <button
                        onClick={handleGenerateGeminiReply}
                        className={`w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg font-semibold transition
                        ${hasGeminiKey ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-300 text-gray-600 cursor-not-allowed'}
                        `}
                        disabled={!hasGeminiKey}
                      >
                        <Bot className="w-5 h-5" />
                        <span>{hasGeminiKey ? 'Generate AI Reply (Gemini)' : 'Select Gemini API Key'}</span>
                      </button>
                      {!hasGeminiKey && (
                        <p className="text-sm text-center text-red-500">
                          Please go to <strong>Settings</strong> tab and select your Gemini API key.
                        </p>
                      )}

                      <div className="flex space-x-2 items-center">
                        <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">
                          <Plus className="w-5 h-5" />
                        </button>
                        <input
                          type="text"
                          placeholder="Type a message..."
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        />
                        <button
                          onClick={() => handleSendMessage()}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                        >
                          <Send className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                  <div className="text-center p-4">
                    <MessageSquare className="w-20 h-20 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">Select a contact to start chatting</p>
                    {isWhatsAppConnected ? (
                      <p className="text-sm mt-2">New <span className="font-semibold">simulated</span> messages will appear here automatically.</p>
                    ) : (
                      <p className="text-sm mt-2">Connect WhatsApp to load your <span className="font-semibold">simulated</span> conversations.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Agent & Bot Activity Logs</h2>
            <div className="space-y-4">
              {!isWhatsAppConnected && (
                <p className="text-center text-gray-500 py-4">Connect WhatsApp to see activity logs.</p>
              )}
              {isWhatsAppConnected && messages.filter(m => m.sender === 'agent').length === 0 && (
                <p className="text-center text-gray-500 py-4">No agent or bot activity logged yet.</p>
              )}
              {isWhatsAppConnected && messages.filter(m => m.sender === 'agent').map(msg => {
                const contact = contacts.find(c => c.id === msg.contactId);
                return (
                  <div key={msg.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        {msg.isBot ? (
                          <Bot className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
                        ) : (
                          <User className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
                        )}
                        <div>
                          <p className="font-semibold text-gray-800">{msg.isBot ? 'Bot Reply' : 'Manual Reply'}</p>
                          <p className="text-sm text-gray-600">To: {contact?.name || 'Unknown'} ({contact?.phone || 'N/A'})</p>
                          {msg.prompt && (
                            <p className="text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full mt-1 inline-block">Trigger: {msg.prompt}</p>
                          )}
                          <p className="text-gray-700 mt-2 text-sm leading-relaxed">{msg.content}</p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{formatTime(msg.timestamp)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                <h2 className="text-xl font-bold flex items-center text-gray-800">
                  <Settings className="w-5 h-5 mr-2 text-green-700" />
                  WhatsApp API Configuration
                </h2>
                {configSaved && (
                  <div className="flex items-center space-x-2 text-green-600 bg-green-50 px-3 py-1 rounded-full text-sm font-semibold border border-green-200">
                    <CheckCheck className="w-4 h-4" />
                    <span>Configuration Saved</span>
                  </div>
                )}
              </div>

              <div className="space-y-5">
                <div>
                  <label htmlFor="phoneNumberId" className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="phoneNumberId"
                    type="text"
                    placeholder="123456789012345"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    value={apiConfig.phoneNumberId}
                    onChange={(e) => setApiConfig({...apiConfig, phoneNumberId: e.target.value})}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    📍 Meta Business Suite → WhatsApp → API Setup → Phone Number ID
                  </p>
                </div>

                <div>
                  <label htmlFor="businessAccountId" className="block text-sm font-medium text-gray-700 mb-2">
                    WhatsApp Business Account ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="businessAccountId"
                    type="text"
                    placeholder="987654321098765"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    value={apiConfig.businessAccountId}
                    onChange={(e) => setApiConfig({...apiConfig, businessAccountId: e.target.value})}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    📍 Your WhatsApp Business Account identifier from Meta
                  </p>
                </div>

                <div>
                  <label htmlFor="apiToken" className="block text-sm font-medium text-gray-700 mb-2">
                    Permanent API Token <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="apiToken"
                    type="password"
                    placeholder="EAAxxxxxxxxxxxxxxxxxx"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    value={apiConfig.apiToken}
                    onChange={(e) => setApiConfig({...apiConfig, apiToken: e.target.value})}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    📍 Generate permanent token: Meta Business Suite → System Users → Generate Token
                  </p>
                </div>

                <div>
                  <label htmlFor="verifyToken" className="block text-sm font-medium text-gray-700 mb-2">
                    Webhook Verify Token
                  </label>
                  <input
                    id="verifyToken"
                    type="text"
                    placeholder="your_secret_verify_token"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    value={apiConfig.verifyToken}
                    onChange={(e) => setApiConfig({...apiConfig, verifyToken: e.target.value})}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This token is used to verify your webhook with Meta
                  </p>
                </div>

                <div className="border-t pt-5 mt-5">
                  <h3 className="text-lg font-bold mb-3 text-gray-800">Webhook & AI Agent Configuration</h3>

                  <div className="mb-4">
                    <label htmlFor="webhookUrl" className="block text-sm font-medium text-gray-700 mb-2">
                      Your Webhook URL (for receiving from WhatsApp)
                    </label>
                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 items-center">
                      <input
                        id="webhookUrl"
                        type="text"
                        placeholder="https://your-backend.com/webhook/whatsapp"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 min-w-0"
                        value={apiConfig.webhookUrl}
                        onChange={(e) => setApiConfig({...apiConfig, webhookUrl: e.target.value})}
                      />
                      <button
                        onClick={handleTestWebhook}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center space-x-2 flex-shrink-0 min-h-[44px]"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>Test</span>
                      </button>
                      {apiConfig.webhookUrl && (
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${connectionStatus.webhook ? 'bg-green-500' : 'bg-red-500'}`}
                             title={connectionStatus.webhook ? 'Webhook reachable' : 'Webhook not reachable'} />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      ⚡ This receives incoming WhatsApp messages (Meta will send messages to this URL). Button to test reachability.
                    </p>
                  </div>

                  <div className="mb-4">
                    <label htmlFor="n8nWebhookUrl" className="block text-sm font-medium text-gray-700 mb-2">
                      n8n Webhook URL (for AI Agent responses)
                    </label>
                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 items-center">
                      <input
                        id="n8nWebhookUrl"
                        type="text"
                        placeholder="https://your-n8n.com/webhook/agent"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 min-w-0"
                        value={apiConfig.n8nWebhookUrl}
                        onChange={(e) => setApiConfig({...apiConfig, n8nWebhookUrl: e.target.value})}
                      />
                      <button
                        onClick={handleTestN8nWebhook}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center justify-center space-x-2 flex-shrink-0 min-h-[44px]"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>Test</span>
                      </button>
                      {apiConfig.n8nWebhookUrl && (
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${connectionStatus.n8n ? 'bg-green-500' : 'bg-red-500'}`}
                             title={connectionStatus.n8n ? 'n8n webhook reachable' : 'n8n webhook not reachable'} />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      🤖 Messages are typically forwarded here for custom AI processing via n8n workflows. Button to send a test message.
                    </p>
                  </div>

                  {/* New: Backend API URL Input */}
                  <div className="mb-4">
                    <label htmlFor="backendApiUrl" className="block text-sm font-medium text-gray-700 mb-2">
                      Your Backend API URL (for this dashboard)
                    </label>
                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 items-center">
                      <input
                        id="backendApiUrl"
                        type="text"
                        placeholder="https://your-backend-api.com/ (e.g., your Render URL)"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 min-w-0"
                        value={apiConfig.backendApiUrl}
                        onChange={(e) => setApiConfig({...apiConfig, backendApiUrl: e.target.value})}
                      />
                      <button
                        onClick={handleTestBackendApi}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition flex items-center justify-center space-x-2 flex-shrink-0 min-h-[44px]"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>Test</span>
                      </button>
                      {apiConfig.backendApiUrl && (
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${connectionStatus.backendApi ? 'bg-green-500' : 'bg-red-500'}`}
                             title={connectionStatus.backendApi ? 'Backend API reachable' : 'Backend API not reachable'} />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      🔗 This URL will be used by <span className="font-semibold">this dashboard</span> to communicate with your custom backend for real-time chat data, sending messages, etc. Button to test reachability.
                    </p>
                  </div>

                  {/* Gemini API Key Selection */}
                  <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <h3 className="text-lg font-bold text-orange-800 mb-2 flex items-center space-x-2">
                      <Bot className="w-5 h-5" />
                      <span>Gemini AI Key for Direct Agent</span>
                    </h3>
                    <p className="text-sm text-orange-700 mb-3">
                      To enable direct Gemini AI replies within the chat, you need to select your Gemini API key.
                    </p>
                    <button
                      onClick={promptForGeminiApiKey}
                      className={`w-full px-4 py-2 rounded-lg font-semibold transition flex items-center justify-center space-x-2
                        ${hasGeminiKey ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-red-600 text-white hover:bg-red-700'}
                      `}
                    >
                      {hasGeminiKey ? <CheckCheck className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                      <span>{hasGeminiKey ? 'Gemini API Key Selected' : 'Select Gemini API Key'}</span>
                    </button>
                    {!hasGeminiKey && (
                      <p className="text-xs text-orange-800 mt-2">
                        If you encounter issues, ensure your Gemini API key is valid and has billing enabled. <br/>
                        <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline hover:text-orange-900">
                          Link to billing documentation
                        </a>
                      </p>
                    )}
                  </div>


                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-blue-800 font-semibold mb-2">
                      📝 How to configure webhook in Meta Business Suite:
                    </p>
                    <ol className="text-xs text-blue-700 ml-4 list-decimal space-y-1">
                      <li>Copy your webhook URL from above (<code>{apiConfig.webhookUrl || 'N/A'}</code>)</li>
                      <li>Go to Meta Business Suite → WhatsApp → Configuration</li>
                      <li>Click "Edit" on webhook section</li>
                      <li>Paste webhook URL and your Verify Token (<code>{apiConfig.verifyToken}</code>)</li>
                      <li>Subscribe to: <code className="bg-blue-100 px-1 rounded">messages</code>, <code className="bg-blue-100 px-1 rounded">message_status</code></li>
                      <li>Save and verify. Meta will send a GET request to your webhook for verification.</li>
                    </ol>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 mt-6">
                  <button
                    onClick={handleSaveConfig}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold flex items-center justify-center space-x-2 flex-grow"
                  >
                    <CheckCheck className="w-4 h-4" />
                    <span>Save Configuration</span>
                  </button>
                  <button
                    onClick={handleLoadConfig}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center space-x-2 flex-grow"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Load Saved Config</span>
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to reset ALL configuration fields? This will also disconnect WhatsApp and clear chats.')) {
                        setApiConfig({
                          phoneNumberId: '',
                          businessAccountId: '',
                          apiToken: '',
                          webhookUrl: '',
                          n8nWebhookUrl: '',
                          verifyToken: 'your_verify_token_123',
                          backendApiUrl: '' // Reset backendApiUrl
                        });
                        setConfigSaved(false);
                        localStorage.removeItem('whatsapp_config');
                        setApiStatus(prev => ({ ...prev, phoneNumber: 'Not Connected', online: false, apiConnected: false }));
                        setConnectionStatus({ whatsapp: false, webhook: false, n8n: false, backendApi: false }); // Reset backendApi status
                        setHasGeminiKey(false);
                        setIsWhatsAppConnected(false); // Reset WhatsApp connected state
                        setContacts([]);
                        setMessages([]);
                        setStats({ totalMessages: 0, unreadMessages: 0, botReplies: 0, manualReplies: 0 });
                        setSelectedContact(null);
                        alert('✅ Configuration reset successfully');
                      }
                    }}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition flex-grow"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4">🚀 Quick Start Guide</h2>
              <div className="space-y-4 text-sm text-gray-700">
                <div className="bg-green-50 border-l-4 border-green-500 p-4">
                  <p className="font-semibold text-green-800 mb-2">✅ Step 1: Get WhatsApp API Credentials</p>
                  <ul className="list-disc ml-5 space-y-1 text-green-700">
                    <li>Visit: <a href="https://business.facebook.com" target="_blank" className="underline">business.facebook.com</a></li>
                    <li>Create/Login to Business Account</li>
                    <li>Add WhatsApp Product</li>
                    <li>Copy Phone Number ID and Business Account ID</li>
                    <li>Generate permanent access token</li>
                  </ul>
                </div>

                <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
                  <p className="font-semibold text-blue-800 mb-2">✅ Step 2: Configure This Dashboard & Connect</p>
                  <ul className="list-disc ml-5 space-y-1 text-blue-700">
                    <li>Fill all fields above with your credentials</li>
                    <li>Click "Save Configuration"</li>
                    <li>Go to Dashboard tab</li>
                    <li>Click "Connect WhatsApp" button (This verifies your credentials and loads simulated chats)</li>
                  </ul>
                </div>

                <div className="bg-purple-50 border-l-4 border-purple-500 p-4">
                  <p className="font-semibold text-purple-800 mb-2">✅ Step 3: Setup Webhook & AI Backend (for Real Live Chats)</p>
                  <ul className="list-disc ml-5 space-y-1 text-purple-700">
                    <li>Deploy a <span className="font-bold">backend server</span> to securely handle Meta's webhooks.</li>
                    <li>Configure your webhook URL (<code>{apiConfig.webhookUrl || 'YOUR_META_WEBHOOK_URL'}</code>) in Meta Business Suite.</li>
                    <li>Your n8n URL (<code>{apiConfig.n8nWebhookUrl || 'YOUR_N8N_WEBHOOK_URL'}</code>) is where your backend can forward messages for AI processing.</li>
                    <li>Set your Backend API URL (<code>{apiConfig.backendApiUrl || 'YOUR_DASHBOARD_BACKEND_API_URL'}</code>) in the settings above.</li>
                    <li>Test all configured webhooks and backend API using the "Test" buttons above.</li>
                  </ul>
                </div>

                <div className="bg-orange-50 border-l-4 border-orange-500 p-4">
                  <p className="font-semibold text-orange-800 mb-2">⚠️ Important Notes for Production</p>
                  <ul className="list-disc ml-5 space-y-1 text-orange-700">
                    <li>For <span className="font-bold">actual real-time WhatsApp chats and history</span>, you <span className="font-bold">MUST use a backend server</span>.</li>
                    <li>A backend secures your API token and receives incoming messages via webhooks.</li>
                    <li>Keep your API token secure - never share it publicly or expose it directly in frontend code.</li>
                    <li>Use HTTPS for all webhook URLs.</li>
                    <li>Ensure your Gemini API key (in Settings) is valid and has billing enabled for AI replies.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;