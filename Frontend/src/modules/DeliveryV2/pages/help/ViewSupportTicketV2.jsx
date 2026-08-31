import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  ArrowLeft, Clock, CheckCircle, XCircle, 
  Loader2, MessageSquare, ShieldCheck, Mail, Send
} from 'lucide-react';
import { deliveryAPI } from '@food/api';
import { toast } from 'sonner';
import useDeliveryBackNavigation from '../../hooks/useDeliveryBackNavigation';
import BRAND_THEME from '@/config/brandTheme';

/**
 * ViewSupportTicketV2 - Restored Old UI for Ticket Details.
 */
export const ViewSupportTicketV2 = () => {
  const goBack = useDeliveryBackNavigation();
  const { ticketId } = useParams();
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyMessage, setReplyMessage] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    const fetchTicket = async () => {
      try {
        setLoading(true);
        const response = await deliveryAPI.getSupportTicketById(ticketId);
        if (response?.data?.success) {
          const payload = response?.data?.data || {};
          const found = payload?.ticket || payload || null;
          setTicket(found);
          setMessages(Array.isArray(payload?.messages) ? payload.messages : []);
        }
      } catch (error) {
        toast.error("Failed to load ticket details");
      } finally {
        setLoading(false);
      }
    };
    fetchTicket();
  }, [ticketId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="w-8 h-8 animate-spin" style={{ color: BRAND_THEME.colors.brand.primary }} /></div>;
  if (!ticket) return <div className="p-20 text-center text-gray-400 font-bold uppercase tracking-widest h-screen">Ticket Not Found</div>;

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "open": return "text-orange-600 bg-orange-50";
      case "resolved": return "text-green-600 bg-green-50";
      case "closed": return "text-gray-600 bg-gray-50";
      default: return "text-brand-600 bg-brand-50";
    }
  };

  const formatMessageTime = (value) => {
    if (!value) return "-"
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("en-IN")
  }

  const sendReply = async () => {
    if (!ticket?._id) return
    if (!replyMessage.trim()) return toast.error("Please enter a message")
    setSendingReply(true)
    try {
      const response = await deliveryAPI.sendSupportTicketMessage(ticket._id, {
        message: replyMessage.trim(),
      });
      const data = response?.data?.data || {};
      if (data.ticket) setTicket(data.ticket);
      if (data.message) setMessages((prev) => [...prev, data.message]);
      setReplyMessage("");
      toast.success("Message sent");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to send message");
    } finally {
      setSendingReply(false);
    }
  };

  const updateTicketStatus = async (status) => {
    if (!ticket?._id) return
    setUpdatingStatus(true)
    try {
      const response = await deliveryAPI.updateSupportTicketStatus(ticket._id, { status });
      const data = response?.data?.data || {};
      if (data.ticket) setTicket(data.ticket);
      if (Array.isArray(data.messages)) setMessages(data.messages);
      toast.success(status === "closed" ? "Ticket closed" : "Ticket reopened");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update ticket");
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-poppins pb-20">
      {/* Header */}
      <div className="bg-white px-4 py-5 flex items-center gap-4 fixed top-0 w-full z-50 shadow-sm border-b border-gray-50">
        <button onClick={goBack} className="p-1 hover:bg-gray-50 rounded-full">
           <ArrowLeft className="w-6 h-6 text-gray-950" />
        </button>
        <h1 className="text-xl font-black text-gray-950 uppercase tracking-tight">Ticket Info</h1>
      </div>

      <div className="pt-24 px-4 space-y-6">
         {/* Status & ID */}
         <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
            <div className="space-y-1">
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ID Reference</p>
               <h3 className="text-lg font-black text-gray-950">#{ticket.ticketId || "Pending"}</h3>
            </div>
            <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${getStatusColor(ticket.status)}`}>
               {ticket.status}
            </div>
         </div>

         {/* Subject & Description */}
         <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
            <div className="space-y-1">
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Subject</p>
               <h4 className="text-sm font-black text-gray-950">{ticket.subject}</h4>
            </div>
            <div className="space-y-1 pt-4 border-t border-gray-50">
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Detail Description</p>
               <p className="text-xs text-gray-600 font-medium leading-relaxed">{ticket.description}</p>
            </div>
         </div>

         <div className="bg-white rounded-3xl p-6 shadow-sm border border-brand-100 space-y-4">
            <div className="flex items-start gap-4">
               <div className="w-10 h-10 rounded-2xl bg-brand-50 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" style={{ color: BRAND_THEME.colors.brand.primary }} />
               </div>
               <div className="space-y-2">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Conversation</p>
                  <p className="text-xs font-bold leading-relaxed italic" style={{ color: BRAND_THEME.colors.brand.primary }}>
                    {ticket.status === "closed"
                      ? "This ticket is closed. Reopen it to continue chatting."
                      : "You and admin can both send many messages on this ticket."}
                  </p>
               </div>
            </div>

            <div className="space-y-3 max-h-[340px] overflow-y-auto rounded-2xl bg-gray-50 p-3">
              {messages.length === 0 ? (
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest text-center py-6">
                  No messages yet
                </p>
              ) : messages.map((message) => {
                const isSystem = message.isSystemMessage === true;
                const isDelivery = !isSystem && message.senderType === "delivery";

                if (isSystem) {
                  return (
                    <div key={message._id} className="flex justify-center my-2">
                      <div className="text-center px-3 py-1.5 text-xs font-semibold text-gray-500">
                        <span>{message.message}</span>
                        <span className="ml-2 text-[10px] font-normal text-gray-400">
                          {formatMessageTime(message.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={message._id}
                    className={`flex ${isDelivery ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[82%] rounded-2xl px-4 py-3 ${
                        isDelivery
                          ? "text-white"
                          : "bg-white border border-brand-100 text-gray-900"
                      }`}
                      style={isDelivery ? { background: BRAND_THEME.colors.brand.primary } : undefined}
                    >
                      <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDelivery ? "text-white/80" : "text-gray-400"}`}>
                        {isDelivery ? "You" : "Admin"}
                      </p>
                      <p className="text-xs font-bold leading-relaxed whitespace-pre-wrap">{message.message}</p>
                      <p className={`mt-2 text-[10px] font-bold ${isDelivery ? "text-white/80" : "text-gray-400"}`}>
                        {formatMessageTime(message.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => updateTicketStatus(ticket.status === "closed" ? "open" : "closed")}
                disabled={updatingStatus}
                className="rounded-2xl border border-gray-200 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-700 disabled:opacity-50"
              >
                {updatingStatus ? "Updating..." : ticket.status === "closed" ? "Reopen Ticket" : "Close Ticket"}
              </button>
            </div>

            <div className="space-y-3 pt-2">
              <textarea
                rows={4}
                placeholder={ticket.status === "closed" ? "Reopen this ticket to continue chatting" : "Type your reply..."}
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                disabled={ticket.status === "closed" || sendingReply}
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold text-gray-950 focus:ring-4 focus:ring-orange-500/10 transition-all outline-none resize-none"
              />
              <button
                onClick={sendReply}
                disabled={ticket.status === "closed" || !replyMessage.trim() || sendingReply}
                className="w-full text-white p-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 disabled:opacity-50"
                style={{ background: BRAND_THEME.colors.brand.primary }}
              >
                {sendingReply ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                Send Message
              </button>
            </div>
         </div>

         <div className="mt-10 flex flex-col items-center justify-center opacity-20 gap-4">
            <Mail className="w-12 h-12" />
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-center">FreshCut Local Support Fleet</p>
         </div>
      </div>
    </div>
  );
};
