'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Mic, MicOff, Bot, User, Activity, Shield, AlertTriangle, MapPin, Pill, Heart } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { SUPPORTED_LANGUAGES } from '@/lib/types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agent?: string;
  timestamp: Date;
}

const agentResponses: Record<string, Record<string, string[]>> = {
  triage: {
    greeting: [
      "Hello! I'm the Triage Agent. Please describe your symptoms and I'll help assess the urgency.",
      "Welcome to Nirog-Setu. What health concern brings you here today?",
    ],
    cough: [
      "Based on your symptoms of cough, I'm routing you to the Diagnose Agent for further evaluation. Severity: Medium.",
      "Persistent cough requires evaluation. I'm marking this as moderate severity and referring for diagnosis.",
    ],
    fever: [
      "Fever noted. Is it accompanied by other symptoms like chills, body pain, or cough? Severity assessment: Monitor closely.",
      "High fever requires attention. I'm escalating this to our diagnostic team.",
    ],
    emergency: [
      "🚨 EMERGENCY DETECTED. Activating Emergency Protocol immediately. Do not hang up. Help is on the way.",
      "URGENT: This appears to be a medical emergency. Emergency services are being contacted. Stay on the line.",
    ],
  },
  diagnose: {
    tb: [
      "Based on your symptoms (persistent cough, fever, night sweats), I suspect Pulmonary Tuberculosis with 85% confidence. Recommended tests: Chest X-ray, sputum AFB smear.",
      "TB indicators present. Confidence: 82%. Suggesting immediate screening at nearest DST Center.",
    ],
    malaria: [
      "Symptoms match malaria pattern (high fever, chills, body ache). Confidence: 78%. Recommended: Rapid Diagnostic Test (RDT) for malaria.",
      "Malaria indicated by fever cycle. Suggest Paracetamol for fever management and RDT within 24 hours.",
    ],
    general: [
      "Analyzing symptoms across our medical knowledge base... Your symptoms suggest a viral infection. Confidence: 75%. Recommend rest and hydration.",
    ],
  },
  prescribe: {
    tb: [
      "Treatment Protocol: DOTS therapy (Category I) for 6 months. Daily supervised medication. Schedule: RNTCP center visits thrice weekly.",
    ],
    malaria: [
      "Prescribed: Artemisinin Combination Therapy (ACT). Complete full 3-day course even if symptoms improve. Follow-up in 7 days.",
    ],
    diabetes: [
      "Management plan: Lifestyle modifications + Metformin 500mg twice daily. Diet: Low glycemic foods, regular exercise. Review in 2 weeks.",
    ],
  },
  refer: {
    hospital: [
      "📍 Referring to District Hospital Patna. Distance: 8.5 km. Beds available: 12. Contact: 0612-2234567",
      "Nearest facility: PHC Muzaffarpur. OPD open today 9AM-4PM. Bring: ID proof, previous reports.",
    ],
  },
  asha: {
    notify: [
      "ASHA worker Sunita Devi has been notified. Expected visit: Within 24 hours. She will call before arriving.",
      "Your ASHA worker has been assigned. They will follow up on medication compliance and health monitoring.",
    ],
  },
  emergency: {
    dispatch: [
      "🚑 Ambulance #BR-05-1234 dispatched. ETA: 18 minutes. Driver: Ramesh Kumar (91234XXXXX). Hospital notified.",
      "Emergency response activated. Police alerted for traffic clearance. Ambulance en route. Estimated arrival: 12 minutes.",
    ],
  },
};

export default function TestChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [language, setLanguage] = useState('hi');
  const [isRecording, setIsRecording] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<string>('triage');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Add greeting message
    addBotMessage("Hello! I'm Nirog-Setu AI, your health assistant. Describe your symptoms and I'll help you get the right care. I support 10 Indian languages.", 'triage');
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const addBotMessage = (content: string, agent: string) => {
    const newMsg: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content,
      agent,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMsg]);
    setCurrentAgent(agent);
  };

  const addUserMessage = (content: string) => {
    const newMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMsg]);
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    addUserMessage(userMessage);
    setInput('');

    // Simulate processing delay
    await new Promise((r) => setTimeout(r, 1000 + Math.random() * 1000));

    // Simple intent detection and response simulation
    const lowerInput = userMessage.toLowerCase();

    if (lowerInput.includes('emergency') || lowerInput.includes('chest pain') || lowerInput.includes('breathing') || lowerInput.includes('stroke')) {
      addBotMessage(agentResponses.emergency.dispatch[0], 'emergency');
    } else if (lowerInput.includes('cough') || lowerInput.includes('tb') || lowerInput.includes('tuberculosis')) {
      if (lowerInput.includes('weeks') || lowerInput.includes('night sweat') || lowerInput.includes('weight loss')) {
        addBotMessage(agentResponses.diagnose.tb[0], 'diagnose');
        setTimeout(() => addBotMessage(agentResponses.prescribe.tb[0], 'prescribe'), 1500);
        setTimeout(() => addBotMessage(agentResponses.asha.notify[0], 'asha'), 3000);
      } else {
        addBotMessage(agentResponses.triage.cough[Math.floor(Math.random() * 2)], 'triage');
      }
    } else if (lowerInput.includes('fever') || lowerInput.includes('malaria') || lowerInput.includes('chills')) {
      addBotMessage(agentResponses.triage.fever[0], 'triage');
      setTimeout(() => addBotMessage(agentResponses.diagnose.malaria[0], 'diagnose'), 1500);
    } else if (lowerInput.includes('hospital') || lowerInput.includes('nearby') || lowerInput.includes('refer')) {
      addBotMessage(agentResponses.refer.hospital[0], 'refer');
    } else if (lowerInput.includes('diabetes') || lowerInput.includes('sugar') || lowerInput.includes('thirst')) {
      addBotMessage(agentResponses.diagnose.general[0], 'diagnose');
    } else if (lowerInput.includes('hello') || lowerInput.includes('help')) {
      addBotMessage(agentResponses.triage.greeting[0], 'triage');
    } else {
      // Default response
      addBotMessage(
        `I understand you're experiencing: "${userMessage}". Let me analyze this... Your case has been noted. I recommend visiting your nearest Primary Health Center for evaluation. Would you like me to find nearby facilities?`,
        'diagnose'
      );
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      // Simulate voice input
      setTimeout(() => {
        setInput('मुझे तीन हफ्तों से खांसी है और रात को पसीना आता है');
        setIsRecording(false);
      }, 2000);
    }
  };

  const agentConfig: Record<string, { name: string; icon: typeof Activity; color: string }> = {
    triage: { name: 'Triage Agent', icon: Activity, color: 'text-emerald-500' },
    diagnose: { name: 'Diagnose Agent', icon: Shield, color: 'text-blue-500' },
    prescribe: { name: 'Prescribe Agent', icon: Pill, color: 'text-purple-500' },
    refer: { name: 'Refer Agent', icon: MapPin, color: 'text-amber-500' },
    asha: { name: 'ASHA Agent', icon: Heart, color: 'text-rose-500' },
    emergency: { name: 'Emergency Agent', icon: AlertTriangle, color: 'text-red-500' },
  };

  return (
    <div className="p-6 h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            Test Chat
          </h1>
          <p className="text-muted-foreground text-sm">
            Simulate patient interaction with AI agents
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.native} ({lang.name})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted">
            <Bot className="h-4 w-4" />
            <span className="text-sm">{agentConfig[currentAgent]?.name}</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <Card className="flex-1 overflow-hidden">
        <CardContent className="h-full p-4 overflow-y-auto scrollbar-thin">
          <div className="space-y-4">
            {messages.map((message) => {
              const config = message.agent ? agentConfig[message.agent] : null;
              const AgentIcon = config?.icon || Bot;
              return (
                <div
                  key={message.id}
                  className={cn(
                    'flex gap-3',
                    message.role === 'user' && 'flex-row-reverse'
                  )}
                >
                  <div
                    className={cn(
                      'h-8 w-8 rounded-full flex items-center justify-center shrink-0',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                  >
                    {message.role === 'user' ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <AgentIcon className={cn('h-4 w-4', config?.color)} />
                    )}
                  </div>
                  <div
                    className={cn(
                      'max-w-[80%] rounded-lg p-3',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                  >
                    {config && message.role === 'assistant' && (
                      <div className="text-xs mb-1 font-medium" style={{ color: config.color }}>
                        {config.name}
                      </div>
                    )}
                    <p className="text-sm">{message.content}</p>
                    <div
                      className={cn(
                        'text-xs mt-1 opacity-60',
                        message.role === 'user' ? 'text-right' : ''
                      )}
                    >
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </CardContent>
      </Card>

      {/* Input */}
      <div className="mt-4 flex gap-2">
        <Button
          variant={isRecording ? 'destructive' : 'outline'}
          size="icon"
          onClick={toggleRecording}
          className={cn(isRecording && 'animate-pulse')}
        >
          {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
        <Textarea
          placeholder="Type your symptoms here... (e.g., 'I have cough for 3 weeks with night sweats')"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          className="min-h-[60px] resize-none"
        />
        <Button onClick={handleSend} size="icon" className="h-auto">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
