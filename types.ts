export interface Contact {
  id: number;
  name: string;
  phone: string;
  lastMessage: string;
  lastMessageTime: Date;
  unread: number;
  avatar: string;
}

export interface Message {
  id: number;
  contactId: number;
  sender: 'customer' | 'agent';
  content: string;
  type: 'text' | 'image' | 'file' | 'audio';
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  isBot: boolean;
  prompt?: string;
}

export interface ApiStatus {
  phoneNumber: string;
  online: boolean;
  webhookConnected: boolean;
  apiConnected: boolean;
  lastSync: Date;
}

export interface Stats {
  totalMessages: number;
  unreadMessages: number;
  botReplies: number;
  manualReplies: number;
}

export interface ApiConfig {
  phoneNumberId: string;
  businessAccountId: string;
  apiToken: string;
  webhookUrl: string;
  n8nWebhookUrl: string;
  verifyToken: string;
  backendApiUrl: string; // New: URL for the custom backend API
}

export interface ConnectionStatus {
  whatsapp: boolean;
  webhook: boolean;
  n8n: boolean;
  backendApi: boolean; // New: Status for backend API reachability
}