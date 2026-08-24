import React, { useState, useEffect } from 'react';
import {
  Calendar, Clock, FileText, User, Users, Home, UserCircle, Stethoscope,
  Hospital, Brain, CheckCircle, AlertTriangle, PlusCircle, X, ChevronDown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config.js';

// ─── Shared Components ────────────────────────────────────────────────────────
const Button = ({ children, variant = 'primary', size = 'md', className = '', disabled, ...props }) => {
  const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' };
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
    outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50',
    ghost: 'text-gray-600 hover:bg-gray-100',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };
  return <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} disabled={disabled} {...props}>{children}</button>;
};

const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${className}`}>{children}</div>
);

const Badge = ({ children, type = 'default' }) => {
  const styles = {
    default: 'bg-gray-100 text-gray-700', info: 'bg-blue-100 text-blue-700',
    success: 'bg-emerald-100 text-emerald-700', warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-red-100 text-red-700', high: 'bg-red-100 text-red-700',
    medium: 'bg-amber-100 text-amber-700', low: 'bg-emerald-100 text-emerald-700',
  };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[type] || styles.default}`}>{children}</span>;
};

const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, []);
  const styles = { success: 'bg-emerald-600', error: 'bg-red-600', info: 'bg-blue-600' };
  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg text-white shadow-lg ${styles[type] || styles.info} max-w-sm`}>
      <span className="text-sm">{message}</span>
      <button onClick={onClose}><X size={16} /></button>
    </div>
  );
};

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 overflow-y-auto py-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DoctorDashboard() {
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [doctorInfo, setDoctorInfo] = useState(null);
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [allAppointments, setAllAppointments] = useState([]);
  const [existingPrescriptions, setExistingPrescriptions] = useState([]);
  const [toasts, setToasts] = useState([]);

  // Appointment detail modal
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [notesForm, setNotesForm] = useState({ clinicalNotes: '', medicines: [] });
  const [savingNotes, setSavingNotes] = useState(false);
  const [newMedicine, setNewMedicine] = useState({ name: '', dosage: '', frequency: '', durationDays: 7, instructions: '' });

  // Legacy patient mgmt
  const [appointmentData, setAppointmentData] = useState({ patientId: '', date: '', time: '', reason: '', medication: '', dosage: '', frequency: '' });
  const [selectedAction, setSelectedAction] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);

  const [showPrescriptions, setShowPrescriptions] = useState(false);

  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const addToast = (msg, type = 'info') => {
    const id = Date.now();
    setToasts((p) => [...p, { id, message: msg, type }]);
  };
  const removeToast = (id) => setToasts((p) => p.filter((t) => t.id !== id));

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    fetchDoctorProfile();
    fetchPatientsWithAppointments();
    fetchTodayAppointments();
    fetchAllAppointments();
  }, []);

  useEffect(() => {
    if (appointmentData.patientId) fetchExistingPrescriptions(appointmentData.patientId);
  }, [appointmentData.patientId]);

  const fetchDoctorProfile = async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/doctor/profile`, { headers });
      if (r.ok) { const d = await r.json(); setDoctorInfo(d); }
    } catch {}
  };

  const fetchTodayAppointments = async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/doctor/appointments`, { headers });
      if (r.ok) setAppointments(await r.json());
    } catch {}
  };

  const fetchAllAppointments = async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/appointments`, { headers });
      if (r.ok) { const d = await r.json(); setAllAppointments(d.appointments || []); }
    } catch {}
  };

  const fetchPatientsWithAppointments = async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/doctor/patients-with-appointments`, { headers });
      if (r.ok) setPatients(await r.json());
    } catch {}
  };

  const fetchExistingPrescriptions = async (patientId) => {
    if (!patientId) return;
    try {
      const r = await fetch(`${API_BASE_URL}/api/doctor/prescriptions/${patientId}`, { headers });
      if (r.ok) setExistingPrescriptions(await r.json());
    } catch {}
  };

  const fetchAvailableSlotsDoctor = async (patientId, date) => {
    if (!patientId || !date) return;
    try {
      const r = await fetch(`${API_BASE_URL}/api/doctor/available-slots?patientId=${patientId}&date=${date}`, { headers });
      if (r.ok) setAvailableSlots(await r.json());
    } catch {}
  };

  // ─── Post-Visit Notes Submission ──────────────────────────────────────────────
  const handleSubmitNotes = async () => {
    if (!notesForm.clinicalNotes.trim()) {
      addToast('Please enter clinical notes.', 'error');
      return;
    }
    setSavingNotes(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/appointments/${selectedAppt._id}/notes`, {
        method: 'POST', headers,
        body: JSON.stringify({
          clinicalNotes: notesForm.clinicalNotes,
          prescription: { medicines: notesForm.medicines },
        }),
      });
      const data = await r.json();
      if (r.ok) {
        addToast('Visit notes saved. AI post-visit summary being generated and sent to patient.', 'success');
        setSelectedAppt(null);
        fetchTodayAppointments();
        fetchAllAppointments();
      } else {
        addToast(data.message || 'Failed to save notes.', 'error');
      }
    } catch { addToast('Network error.', 'error'); }
    setSavingNotes(false);
  };

  const addMedicine = () => {
    if (!newMedicine.name || !newMedicine.dosage || !newMedicine.frequency) {
      addToast('Please fill medicine name, dosage, and frequency.', 'error');
      return;
    }
    setNotesForm((p) => ({ ...p, medicines: [...p.medicines, { ...newMedicine }] }));
    setNewMedicine({ name: '', dosage: '', frequency: '', durationDays: 7, instructions: '' });
  };

  // ─── Dashboard ─────────────────────────────────────────────────────────────────
  const renderDashboard = () => {
    const completed = allAppointments.filter((a) => a.status === 'COMPLETED').length;
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Today's Schedule", value: appointments.length, icon: Calendar, color: 'blue' },
            { label: 'Total Patients', value: patients.length, icon: Users, color: 'emerald' },
            { label: 'Completed Visits', value: completed, icon: CheckCircle, color: 'purple' },
            { label: 'Specialty', value: doctorInfo?.specialty || '—', icon: Stethoscope, color: 'gray', text: true },
          ].map(({ label, value, icon: Icon, color, text }) => (
            <Card key={label} className="p-4">
              <div className={`w-10 h-10 bg-${color}-100 rounded-lg flex items-center justify-center mb-2`}>
                <Icon size={20} className={`text-${color}-600`} />
              </div>
              <div className={`${text ? 'text-base' : 'text-2xl'} font-bold text-gray-900`}>{value}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </Card>
          ))}
        </div>

        {/* Today's Schedule */}
        <Card>
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Calendar size={18} className="text-blue-600" /> Today's Schedule</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {appointments.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">No appointments today.</div>
            ) : appointments.map((appt) => (
              <div key={appt._id} className="p-4 flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{appt.patientId?.firstName} {appt.patientId?.lastName}</p>
                    {appt.aiUrgency && appt.aiUrgency !== 'Unavailable' && (
                      <Badge type={appt.aiUrgency.toLowerCase()}>{appt.aiUrgency}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{appt.startTime} – {appt.endTime}</p>
                  {appt.symptoms?.chiefSymptoms && (
                    <p className="text-xs text-gray-500 mt-1 truncate max-w-xs">
                      🩺 {appt.symptoms.chiefSymptoms}
                    </p>
                  )}
                  {appt.aiPreVisitSummary && (
                    <p className="text-xs text-blue-600 mt-1 truncate max-w-xs">
                      🤖 {appt.aiPreVisitSummary}
                    </p>
                  )}
                </div>
                <Button size="sm" onClick={() => { setSelectedAppt(appt); setNotesForm({ clinicalNotes: appt.clinicalNotes || '', medicines: [] }); }}>
                  {appt.status === 'COMPLETED' ? 'View' : 'Start Visit'}
                </Button>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent Patients */}
        <Card>
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Recent Patients</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {patients.slice(0, 5).map((p) => (
              <div key={p._id} className="p-4 flex justify-between">
                <div>
                  <p className="font-medium text-gray-900">{p.firstName} {p.lastName}</p>
                  <p className="text-xs text-gray-500">
                    Last visit: {p.lastVisit || 'N/A'} · Next: {p.nextAppointment || 'N/A'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  };

  // ─── Visit Modal ───────────────────────────────────────────────────────────────
  const renderVisitModal = () => {
    if (!selectedAppt) return null;
    const isCompleted = selectedAppt.status === 'COMPLETED';

    return (
      <Modal isOpen={!!selectedAppt} onClose={() => setSelectedAppt(null)} title={isCompleted ? 'Visit Summary' : 'Conduct Visit'}>
        {/* Patient Info */}
        <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
          <p className="font-semibold">{selectedAppt.patientId?.firstName} {selectedAppt.patientId?.lastName}</p>
          <p className="text-gray-500">{selectedAppt.date} · {selectedAppt.startTime}</p>
          {selectedAppt.aiUrgency && selectedAppt.aiUrgency !== 'Unavailable' && (
            <div className="mt-1"><Badge type={selectedAppt.aiUrgency.toLowerCase()}>Urgency: {selectedAppt.aiUrgency}</Badge></div>
          )}
        </div>

        {/* Symptoms */}
        {selectedAppt.symptoms?.chiefSymptoms && (
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-700 mb-1">Patient Symptoms</p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm space-y-1">
              <p>{selectedAppt.symptoms.chiefSymptoms}</p>
              {selectedAppt.symptoms.duration && <p className="text-gray-500">Duration: {selectedAppt.symptoms.duration}</p>}
              {selectedAppt.symptoms.severity && <p className="text-gray-500">Severity: {selectedAppt.symptoms.severity}</p>}
              {selectedAppt.symptoms.additionalNotes && <p className="text-gray-500">{selectedAppt.symptoms.additionalNotes}</p>}
            </div>
          </div>
        )}

        {/* AI Pre-Visit */}
        {selectedAppt.aiSuggestedQuestions?.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1"><Brain size={14} className="text-blue-600" /> AI Suggested Questions</p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <ul className="space-y-1">
                {selectedAppt.aiSuggestedQuestions.map((q, i) => (
                  <li key={i} className="text-xs text-blue-800">• {q}</li>
                ))}
              </ul>
              <p className="text-xs text-gray-400 mt-2">AI-generated. Not a diagnosis.</p>
            </div>
          </div>
        )}

        {!isCompleted && (
          <>
            {/* Clinical Notes */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Clinical Notes *</label>
              <textarea
                rows={4}
                placeholder="Enter your clinical observations, diagnosis, and recommendations..."
                value={notesForm.clinicalNotes}
                onChange={(e) => setNotesForm((p) => ({ ...p, clinicalNotes: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Prescription */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Prescription</label>

              {/* Added medicines */}
              {notesForm.medicines.length > 0 && (
                <div className="mb-3 space-y-2">
                  {notesForm.medicines.map((m, i) => (
                    <div key={i} className="flex justify-between items-center bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-xs">
                      <span><strong>{m.name}</strong> · {m.dosage} · {m.frequency} · {m.durationDays} days</span>
                      <button
                        onClick={() => setNotesForm((p) => ({ ...p, medicines: p.medicines.filter((_, j) => j !== i) }))}
                        className="text-red-400 hover:text-red-600 ml-2"
                      ><X size={14} /></button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add medicine form */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    placeholder="Medicine name"
                    value={newMedicine.name}
                    onChange={(e) => setNewMedicine((p) => ({ ...p, name: e.target.value }))}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    placeholder="Dosage (e.g. 500mg)"
                    value={newMedicine.dosage}
                    onChange={(e) => setNewMedicine((p) => ({ ...p, dosage: e.target.value }))}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={newMedicine.frequency}
                    onChange={(e) => setNewMedicine((p) => ({ ...p, frequency: e.target.value }))}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Frequency</option>
                    <option value="once_daily">Once daily</option>
                    <option value="twice_daily">Twice daily</option>
                    <option value="three_daily">Three times daily</option>
                    <option value="four_daily">Four times daily</option>
                    <option value="as_needed">As needed</option>
                  </select>
                  <input
                    type="number" min="1" placeholder="Days"
                    value={newMedicine.durationDays}
                    onChange={(e) => setNewMedicine((p) => ({ ...p, durationDays: parseInt(e.target.value) || 7 }))}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <input
                  placeholder="Instructions (optional, e.g. take with food)"
                  value={newMedicine.instructions}
                  onChange={(e) => setNewMedicine((p) => ({ ...p, instructions: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-500"
                />
                <Button size="sm" variant="outline" onClick={addMedicine} className="w-full">
                  <PlusCircle size={14} className="mr-1" /> Add Medicine
                </Button>
              </div>
            </div>

            <Button className="w-full" onClick={handleSubmitNotes} disabled={savingNotes}>
              {savingNotes ? 'Saving...' : 'Complete Visit & Generate AI Summary'}
            </Button>
          </>
        )}

        {isCompleted && selectedAppt.clinicalNotes && (
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Clinical Notes</p>
            <div className="bg-gray-50 rounded-lg p-3 text-sm">{selectedAppt.clinicalNotes}</div>
          </div>
        )}
      </Modal>
    );
  };

  // ─── Legacy Patient Management (kept for backward compat) ────────────────────
  const renderPatientManagement = () => {
    const handleInputChange = (e) => {
      const { name, value } = e.target;
      setAppointmentData((p) => ({ ...p, [name]: value }));
      if (name === 'action') setSelectedAction(value);
      if (name === 'patientId') fetchExistingPrescriptions(value);
      if (name === 'date' || name === 'patientId') fetchAvailableSlotsDoctor(appointmentData.patientId, value);
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (selectedAction === 'prescribe-medication') {
        try {
          const url = appointmentData.prescriptionId
            ? `${API_BASE_URL}/api/doctor/prescriptions/${appointmentData.prescriptionId}`
            : `${API_BASE_URL}/api/doctor/prescribe-medication`;
          const method = appointmentData.prescriptionId ? 'PUT' : 'POST';
          const r = await fetch(url, { method, headers, body: JSON.stringify(appointmentData) });
          if (r.ok) { addToast('Prescription saved.', 'success'); fetchExistingPrescriptions(appointmentData.patientId); }
          else addToast('Failed to save prescription.', 'error');
        } catch { addToast('Error.', 'error'); }
      } else if (selectedAction === 'schedule-appointment') {
        try {
          const r = await fetch(`${API_BASE_URL}/api/doctor/schedule-appointment`, {
            method: 'POST', headers,
            body: JSON.stringify({ patientId: appointmentData.patientId, date: appointmentData.date, time: appointmentData.time, reason: appointmentData.reason }),
          });
          if (r.ok) addToast('Appointment scheduled.', 'success');
          else { const d = await r.json(); addToast(d.error || 'Failed.', 'error'); }
        } catch { addToast('Error.', 'error'); }
      }
    };

    return (
      <Card className="max-w-2xl mx-auto p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Patient Management</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Patient</label>
            <select name="patientId" value={appointmentData.patientId} onChange={handleInputChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
              <option value="">Choose a patient</option>
              {patients.map((p) => <option key={p._id} value={p._id}>{p.firstName} {p.lastName}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
            <select name="action" value={selectedAction} onChange={handleInputChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
              <option value="">Choose an action</option>
              <option value="schedule-appointment">Schedule Appointment</option>
              <option value="prescribe-medication">Prescribe Medication</option>
            </select>
          </div>
          {selectedAction === 'schedule-appointment' && (
            <>
              <input type="date" name="date" value={appointmentData.date} onChange={handleInputChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <select name="time" value={appointmentData.time} onChange={handleInputChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" disabled={availableSlots.length === 0}>
                <option value="">Choose time</option>
                {availableSlots.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <input name="reason" placeholder="Reason" value={appointmentData.reason} onChange={handleInputChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </>
          )}
          {selectedAction === 'prescribe-medication' && (
            <>
              {existingPrescriptions.length > 0 && (
                <div className="space-y-1">
                  {existingPrescriptions.map((rx) => (
                    <div key={rx._id} className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2 text-xs">
                      <span>{rx.medication} · {rx.dosage} · {rx.frequency}</span>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setAppointmentData((p) => ({ ...p, prescriptionId: rx._id, medication: rx.medication, dosage: rx.dosage, frequency: rx.frequency })); setSelectedAction('prescribe-medication'); }} className="text-blue-600 hover:underline">Edit</button>
                        <button type="button" onClick={async () => { await fetch(`${API_BASE_URL}/api/doctor/prescriptions/${rx._id}`, { method: 'DELETE', headers }); fetchExistingPrescriptions(appointmentData.patientId); addToast('Deleted.', 'info'); }} className="text-red-500 hover:underline">Del</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <input name="medication" placeholder="Medication name" value={appointmentData.medication || ''} onChange={handleInputChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <input name="dosage" placeholder="Dosage" value={appointmentData.dosage || ''} onChange={handleInputChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <input name="frequency" placeholder="Frequency" value={appointmentData.frequency || ''} onChange={handleInputChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </>
          )}
          <Button type="submit" className="w-full">
            {selectedAction === 'prescribe-medication' ? 'Save Prescription' : 'Schedule Appointment'}
          </Button>
        </form>
      </Card>
    );
  };

  const renderProfile = () => (
    <Card className="max-w-lg mx-auto p-6">
      <h2 className="text-xl font-bold mb-4">Doctor Profile</h2>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between"><span className="text-gray-500">Name</span><span>Dr. {doctorInfo?.firstName} {doctorInfo?.lastName}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Specialty</span><span>{doctorInfo?.specialty}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Qualification</span><span>{doctorInfo?.qualification || 'MBBS'}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Experience</span><span>{doctorInfo?.experience || 0} years</span></div>
        <div className="flex justify-between"><span className="text-gray-500">License</span><span>{doctorInfo?.licenseNumber}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Phone</span><span>{doctorInfo?.phoneNumber}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Slot Duration</span><Badge type="info">{doctorInfo?.slotDurationMinutes || 30} min</Badge></div>
      </div>
    </Card>
  );

  const navItems = [
    { id: 'Dashboard', icon: Home, label: 'Dashboard' },
    { id: 'Patient Management', icon: Users, label: 'Patients' },
    { id: 'Profile', icon: UserCircle, label: 'Profile' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {toasts.map((t) => <Toast key={t.id} {...t} onClose={() => removeToast(t.id)} />)}
      {renderVisitModal()}

      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Hospital size={24} className="text-blue-600" />
            <span className="font-bold text-xl text-gray-900">Medicare</span>
            <span className="hidden sm:inline text-sm text-gray-400">/ Doctor Portal</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 hidden sm:block">Dr. {doctorInfo?.firstName} {doctorInfo?.lastName}</span>
            <Button variant="outline" size="sm" onClick={() => { localStorage.removeItem('token'); navigate('/'); }}>Sign Out</Button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 flex gap-6">
        <aside className="hidden md:block w-48 shrink-0">
          <nav className="space-y-1">
            {navItems.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <Icon size={18} /> {label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            {activeTab === 'Dashboard' ? `Welcome, Dr. ${doctorInfo?.firstName || ''}` : activeTab}
          </h1>
          {activeTab === 'Dashboard' && renderDashboard()}
          {activeTab === 'Patient Management' && renderPatientManagement()}
          {activeTab === 'Profile' && renderProfile()}
        </main>
      </div>
    </div>
  );
}