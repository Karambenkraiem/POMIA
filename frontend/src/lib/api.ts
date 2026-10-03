import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pomia_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('pomia_token');
      localStorage.removeItem('pomia_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// Auth
export const authApi = {
  login: (matricule: string, password: string) =>
    api.post('/auth/login', { matricule, password }).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  updateMe: (data: { nom: string; prenom: string }) =>
    api.put('/auth/me', data).then((r) => r.data),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.put('/auth/change-password', { currentPassword, newPassword }).then((r) => r.data),
  demoUsers: () => api.get('/auth/demo-users').then((r) => r.data),
  demoStatus: () => api.get('/auth/demo-status').then((r) => r.data),
  setDemoStatus: (enabled: boolean) =>
    api.put('/auth/demo-status', { enabled }).then((r) => r.data),
};

// Users
export const usersApi = {
  list: () => api.get('/users').then((r) => r.data),
  create: (data: any) => api.post('/users', data).then((r) => r.data),
  update: (id: string, data: any) => api.put(`/users/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/users/${id}`).then((r) => r.data),
};

// Journées
export const journeesApi = {
  list: (params?: { from?: string; to?: string }) =>
    api.get('/journees', { params }).then((r) => r.data),
  today: () => api.get('/journees/today').then((r) => r.data),
  get: (id: string) => api.get(`/journees/${id}`).then((r) => r.data),
  create: (data: any) => api.post('/journees', data).then((r) => r.data),
  update: (id: string, data: any) => api.put(`/journees/${id}`, data).then((r) => r.data),
  validerBloc: (id: string) => api.post(`/journees/${id}/valider-bloc`).then((r) => r.data),
  validerQuart: (id: string) => api.post(`/journees/${id}/valider-quart`).then((r) => r.data),
  transmettre: (id: string) => api.post(`/journees/${id}/transmettre`).then((r) => r.data),
};

// Postes
export const postesApi = {
  listByJournee: (journeeId: string) =>
    api.get(`/postes/journee/${journeeId}`).then((r) => r.data),
  create: (data: any) => api.post('/postes', data).then((r) => r.data),
  update: (id: string, data: any) => api.put(`/postes/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/postes/${id}`).then((r) => r.data),
};

// Relevés
export const relevesApi = {
  listBloc: (journeeId: string) =>
    api.get(`/releves/bloc/journee/${journeeId}`).then((r) => r.data),
  getBloc: (id: string) => api.get(`/releves/bloc/${id}`).then((r) => r.data),
  createBloc: (data: any) => api.post('/releves/bloc', data).then((r) => r.data),
  updateBloc: (id: string, data: any) => api.put(`/releves/bloc/${id}`, data).then((r) => r.data),
  deleteBloc: (id: string) => api.delete(`/releves/bloc/${id}`).then((r) => r.data),
  deverrouillerBloc: (id: string) => api.post(`/releves/bloc/${id}/deverrouiller`).then((r) => r.data),

  listOp: (journeeId: string) =>
    api.get(`/releves/operateur/journee/${journeeId}`).then((r) => r.data),
  getOp: (id: string) => api.get(`/releves/operateur/${id}`).then((r) => r.data),
  createOp: (data: any) => api.post('/releves/operateur', data).then((r) => r.data),
  updateOp: (id: string, data: any) => api.put(`/releves/operateur/${id}`, data).then((r) => r.data),
  deleteOp: (id: string) => api.delete(`/releves/operateur/${id}`).then((r) => r.data),
  deverrouillerOp: (id: string) => api.post(`/releves/operateur/${id}/deverrouiller`).then((r) => r.data),
  listJour: (date: string) => api.get(`/releves/jour/${date}`).then((r) => r.data),
  range: (source: 'bloc' | 'operateur', from: string, to: string) =>
    api.get('/releves/plage', { params: { source, from, to } }).then((r) => r.data),

  getCompteurs: (journeeId: string) =>
    api.get(`/releves/compteurs/${journeeId}`).then((r) => r.data),
  saveCompteurs: (data: any) => api.post('/releves/compteurs', data).then((r) => r.data),
};

// Manœuvres
export const manouvresApi = {
  list: (journeeId: string) =>
    api.get(`/manouvres/journee/${journeeId}`).then((r) => r.data),
  create: (data: any) => api.post('/manouvres', data).then((r) => r.data),
  update: (id: string, data: any) => api.put(`/manouvres/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/manouvres/${id}`).then((r) => r.data),
};

// Alarmes
export const alarmesApi = {
  list: (journeeId: string) =>
    api.get(`/alarmes/journee/${journeeId}`).then((r) => r.data),
  create: (data: any) => api.post('/alarmes', data).then((r) => r.data),
  update: (id: string, data: any) => api.put(`/alarmes/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/alarmes/${id}`).then((r) => r.data),
};

// OT
export const otApi = {
  list: (journeeId: string) =>
    api.get(`/ot/journee/${journeeId}`).then((r) => r.data),
  listAll: () => api.get('/ot').then((r) => r.data),
  create: (data: any) => api.post('/ot', data).then((r) => r.data),
  update: (id: string, data: any) => api.put(`/ot/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/ot/${id}`).then((r) => r.data),
  listDs: (journeeId: string) =>
    api.get(`/ot/ds/journee/${journeeId}`).then((r) => r.data),
  createDs: (data: any) => api.post('/ot/ds', data).then((r) => r.data),
  removeDs: (id: string) => api.delete(`/ot/ds/${id}`).then((r) => r.data),
};

// Défauts
export const defautsApi = {
  list: (params?: { actif?: string; zone?: string }) =>
    api.get('/defauts', { params }).then((r) => r.data),
  create: (data: any) => api.post('/defauts', data).then((r) => r.data),
  update: (id: string, data: any) => api.put(`/defauts/${id}`, data).then((r) => r.data),
  cloturer: (id: string) => api.post(`/defauts/${id}/cloturer`).then((r) => r.data),
  listSeuils: () => api.get('/defauts/seuils').then((r) => r.data),
  updateSeuil: (id: string, data: any) => api.put(`/defauts/seuils/${id}`, data).then((r) => r.data),
};

// Dashboard
export const dashboardApi = {
  get: (date?: string) => api.get('/dashboard', { params: date ? { date } : undefined }).then((r) => r.data),
};

// Rapport
export const rapportApi = {
  get: (date: string) => api.get('/rapport', { params: { date } }).then((r) => r.data),
};

// Analyse & Diagnostic
export const analyseApi = {
  getSerie: (metricId: string, from: string, to: string) =>
    api.get(`/releves/serie/${metricId}`, { params: { from, to } }).then((r) => r.data),
};

export const rechercheApi = {
  manouvres: (params: { type: string; texte: string; from: string; to: string }) =>
    api.get('/manouvres/recherche', { params }).then((r) => r.data),
};

// Journal d'activité (admin)
export const activityLogApi = {
  list: () => api.get('/activity-logs').then((r) => r.data),
};

// Essais périodiques
// Messagerie interne
export const messagesApi = {
  contacts: () => api.get('/messages/contacts').then((r) => r.data),
  unreadCount: () => api.get('/messages/unread-count').then((r) => r.data),
  conversation: (userId: string) => api.get(`/messages/conversation/${userId}`).then((r) => r.data),
  send: (destinataire_id: string, contenu: string, fichier?: File | null) => {
    if (fichier) {
      const fd = new FormData();
      fd.append('destinataire_id', destinataire_id);
      fd.append('contenu', contenu);
      fd.append('fichier', fichier);
      return api.post('/messages', fd).then((r) => r.data);
    }
    return api.post('/messages', { destinataire_id, contenu }).then((r) => r.data);
  },
  pieceJointeUrl: (messageId: string) => `/messages/${messageId}/piece-jointe`,
};

// Consignes
export const consignesApi = {
  list: () => api.get('/consignes').then((r) => r.data),
  create: (data: any) => api.post('/consignes', data).then((r) => r.data),
  update: (id: string, data: any) => api.put(`/consignes/${id}`, data).then((r) => r.data),
  relancer: (id: string) => api.post(`/consignes/${id}/relancer`).then((r) => r.data),
  remove: (id: string) => api.delete(`/consignes/${id}`).then((r) => r.data),
};

// Réclamations / assistance MD Center
export const reclamationsApi = {
  list: () => api.get('/reclamations').then((r) => r.data),
  get: (id: string) => api.get(`/reclamations/${id}`).then((r) => r.data),
  create: (data: { titre: string; description: string; fichier?: File | null }) => {
    if (data.fichier) {
      const fd = new FormData();
      fd.append('titre', data.titre);
      fd.append('description', data.description);
      fd.append('fichier', data.fichier);
      return api.post('/reclamations', fd).then((r) => r.data);
    }
    return api.post('/reclamations', { titre: data.titre, description: data.description }).then((r) => r.data);
  },
  commenter: (id: string, contenu: string, fichier?: File | null) => {
    if (fichier) {
      const fd = new FormData();
      fd.append('contenu', contenu);
      fd.append('fichier', fichier);
      return api.post(`/reclamations/${id}/commentaires`, fd).then((r) => r.data);
    }
    return api.post(`/reclamations/${id}/commentaires`, { contenu }).then((r) => r.data);
  },
  cloturer: (id: string, motif: string) => api.post(`/reclamations/${id}/cloturer`, { motif }).then((r) => r.data),
  pieceJointeUrl: (id: string) => `/reclamations/${id}/piece-jointe`,
  commentairePieceJointeUrl: (commentId: string) => `/reclamations/commentaires/${commentId}/piece-jointe`,
};

// Récupère une pièce jointe protégée (image/vidéo/PDF) en blob, quel que soit son endpoint d'origine
export const getAttachmentBlob = (url: string) => api.get(url, { responseType: 'blob' }).then((r) => r.data as Blob);

export const essaisApi = {
  list: () => api.get('/essais').then((r) => r.data),
  create: (data: any) => api.post('/essais', data).then((r) => r.data),
  update: (id: string, data: any) => api.put(`/essais/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/essais/${id}`).then((r) => r.data),
  dates: () => api.get('/essais/dates').then((r) => r.data),
  listByJournee: (journeeId: string) => api.get(`/essais/journee/${journeeId}`).then((r) => r.data),
  updateInstance: (id: string, data: any) => api.put(`/essais/instance/${id}`, data).then((r) => r.data),
  deverrouillerInstance: (id: string) => api.post(`/essais/instance/${id}/deverrouiller`).then((r) => r.data),
  historique: (essaiId: string) => api.get(`/essais/${essaiId}/instances`).then((r) => r.data),
  getInstance: (essaiId: string, instanceId: string) => api.get(`/essais/${essaiId}/instances/${instanceId}`).then((r) => r.data),
};
