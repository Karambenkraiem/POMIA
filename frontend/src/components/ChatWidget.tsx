import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, X, ArrowLeft, Send, Paperclip, Camera, Video, Plus } from 'lucide-react';
import { format, isToday } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { messagesApi } from '../lib/api';
import Attachment from './Attachment';
import type { Contact, Message } from '../types';

function timeLabel(iso: string) {
  const d = new Date(iso);
  return isToday(d) ? format(d, 'HH:mm') : format(d, 'dd/MM HH:mm');
}

export default function ChatWidget() {
  const { user } = useAuth();
  const enabled = !!user && user.role !== 'guest';
  const [open, setOpen] = useState(false);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [draft, setDraft] = useState('');
  const [fichier, setFichier] = useState<File | null>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: unread } = useQuery({
    queryKey: ['messages-unread'],
    queryFn: messagesApi.unreadCount,
    enabled,
    refetchInterval: 6000,
  });

  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ['messages-contacts'],
    queryFn: messagesApi.contacts,
    enabled: enabled && open,
    refetchInterval: open ? 6000 : false,
  });

  const { data: conversation } = useQuery<Message[]>({
    queryKey: ['messages-conversation', activeContact?.id],
    queryFn: () => messagesApi.conversation(activeContact!.id),
    enabled: enabled && open && !!activeContact,
    refetchInterval: open && activeContact ? 3000 : false,
  });

  const sendMut = useMutation({
    mutationFn: () => messagesApi.send(activeContact!.id, draft.trim(), fichier),
    onSuccess: () => {
      setDraft('');
      setFichier(null);
      qc.invalidateQueries({ queryKey: ['messages-conversation', activeContact?.id] });
      qc.invalidateQueries({ queryKey: ['messages-contacts'] });
    },
  });

  useEffect(() => {
    if (activeContact) qc.invalidateQueries({ queryKey: ['messages-unread'] });
  }, [conversation, activeContact, qc]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [conversation]);

  const totalUnread = unread?.count ?? 0;

  const sortedContacts = useMemo(() => contacts ?? [], [contacts]);

  function handleSend() {
    if ((!draft.trim() && !fichier) || !activeContact) return;
    sendMut.mutate();
  }

  if (!enabled) return null;

  return (
    <div className="fixed bottom-5 right-5 z-40 print:hidden">
      {open && (
        <div className="mb-3 w-80 h-[28rem] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-800 border-b border-slate-700">
            {activeContact ? (
              <>
                <button onClick={() => setActiveContact(null)} className="text-slate-400 hover:text-white transition-colors">
                  <ArrowLeft size={16} />
                </button>
                <div className="min-w-0">
                  <p className="text-sm text-white font-medium truncate">{activeContact.prenom} {activeContact.nom}</p>
                </div>
              </>
            ) : (
              <p className="text-sm text-white font-medium flex-1">Messages</p>
            )}
            <button onClick={() => setOpen(false)} className="ml-auto text-slate-400 hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>

          {!activeContact && (
            <div className="flex-1 overflow-y-auto">
              {sortedContacts.length === 0 && (
                <p className="text-center text-slate-500 text-xs italic py-6">Aucun contact disponible</p>
              )}
              {sortedContacts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveContact(c)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-800 transition-colors text-left border-b border-slate-800/60"
                >
                  <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-slate-900 font-bold text-xs flex-shrink-0">
                    {c.prenom?.[0]}{c.nom?.[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate">{c.prenom} {c.nom}</p>
                    <p className="text-xs text-slate-500 truncate">{c.dernierMessage || 'Aucun message'}</p>
                  </div>
                  {c.unread > 0 && (
                    <span className="flex-shrink-0 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {c.unread}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {activeContact && (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
                {(conversation ?? []).map((m) => {
                  const mine = m.expediteur_id === user?.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-lg px-2.5 py-1.5 text-sm space-y-1 ${mine ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-100'}`}>
                        {m.contenu && <p className="whitespace-pre-wrap break-words">{m.contenu}</p>}
                        {m.piece_jointe_nom && (
                          <Attachment url={messagesApi.pieceJointeUrl(m.id)} nom={m.piece_jointe_nom} type={m.piece_jointe_type} />
                        )}
                        <p className={`text-[10px] mt-0.5 ${mine ? 'text-slate-900/60' : 'text-slate-500'}`}>{timeLabel(m.cree_le)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-slate-700">
                {fichier && (
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 px-2.5 pt-2">
                    <Paperclip size={11} /> <span className="truncate max-w-[180px]">{fichier.name}</span>
                    <button onClick={() => setFichier(null)} className="hover:text-red-400">
                      <X size={11} />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2 px-2.5 py-2 relative">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*,application/pdf"
                    className="hidden"
                    onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
                  />
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
                  />
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
                  />

                  {attachMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setAttachMenuOpen(false)} />
                      <div className="absolute bottom-full left-2.5 mb-2 z-20 bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden w-44">
                        <button
                          onClick={() => { photoInputRef.current?.click(); setAttachMenuOpen(false); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
                        >
                          <Camera size={15} className="text-amber-400" /> Prendre une photo
                        </button>
                        <button
                          onClick={() => { videoInputRef.current?.click(); setAttachMenuOpen(false); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
                        >
                          <Video size={15} className="text-amber-400" /> Filmer une vidéo
                        </button>
                        <button
                          onClick={() => { fileInputRef.current?.click(); setAttachMenuOpen(false); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
                        >
                          <Paperclip size={15} className="text-amber-400" /> Choisir un fichier
                        </button>
                      </div>
                    </>
                  )}
                  <button
                    onClick={() => setAttachMenuOpen((o) => !o)}
                    title="Joindre une photo, une vidéo ou un fichier"
                    className="text-slate-400 hover:text-amber-400 flex-shrink-0 transition-colors relative z-20"
                  >
                    <Plus size={18} />
                  </button>
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                    placeholder="Écrire un message..."
                    className="flex-1 bg-slate-800 border border-slate-600 rounded-full px-3 py-1.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    onClick={handleSend}
                    disabled={(!draft.trim() && !fichier) || sendMut.isPending}
                    className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-900 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 transition-colors"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-600 shadow-2xl flex items-center justify-center text-slate-900 transition-colors"
        title="Messagerie"
      >
        <MessageCircle size={24} />
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1 border-2 border-slate-950">
            {totalUnread}
          </span>
        )}
      </button>
    </div>
  );
}
