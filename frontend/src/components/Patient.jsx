import React, { useState, useEffect } from 'react';
import {
  Calendar, Clock, FileText, User, Users, ChevronDown, Home, UserCircle,
  Stethoscope, Hospital, Bell, PlusCircle, X, ChevronRight, AlertTriangle,
  CheckCircle, XCircle, Activity, Brain
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config.js';

// ─── Shared UI Components ─────────────────────────────────────────────────────
const Button = ({ children, variant = 'primary', size = 'md', className = '', disabled, ...props }) => {
  const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' };
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    danger:  'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-blue-500',
    ghost:   'text-gray-600 hover:bg-gray-100 focus:ring-gray-400',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500',
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} disabled={disabled} {...props}>
      {children}
    </button>
  );
};

const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${className}`}>{children}</div>
);

const Badge = ({ children, type = 'default' }) => {
  const styles = {
    default: 'bg-gray-100 text-gray-700',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    danger:  'bg-red-100 text-red-700',
    info:    'bg-blue-100 text-blue-700',
    high:    'bg-red-100 text-red-700',
    medium:  'bg-amber-100 text-amber-700',
    low:     'bg-emerald-100 text-emerald-700',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[type] || styles.default}`}>
      {children}
    </span>
  );
};

const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  const styles = { success: 'bg-emerald-600', error: 'bg-red-600', info: 'bg-blue-600' };
  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg text-white shadow-lg ${styles[type] || styles.info} max-w-sm`}>
      <span className="text-sm">{message}</span>
      <button onClick={onClose} className="ml-2 opacity-80 hover:opacity-100"><X size={16} /></button>
    </div>
  );
};

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
};

// ─── Status Badge helper ──────────────────────────────────────────────────────
const statusBadge = (status) => {
  const map = {
    CONFIRMED: { type: 'success', label: 'Confirmed' },
    COMPLETED: { type: 'info',    label: 'Completed' },
    CANCELLED: { type: 'danger',  label: 'Cancelled' },
    HELD:      { type: 'warning', label: 'Pending' },
  };
  const s = map[status] || { type: 'default', label: status };
  return <Badge type={s.type}>{s.label}</Badge>;
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PatientDashboard() {
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [patientInfo, setPatientInfo]   = useState(null);
  const [doctors, setDoctors]           = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [careTeam, setCareTeam]         = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [toasts, setToasts] = useState([]);

  // Booking state
  const [bookingStep, setBookingStep] = useState(1); // 1=select, 2=symptoms, 3=confirm
  const [bookingData, setBookingData] = useState({ doctorId: '', date: '', startTime: '', endTime: '' });
  const [symptoms, setSymptoms] = useState({ chiefSymptoms: '', duration: '', severity: '', additionalNotes: '' });
  const [aiPreview, setAiPreview] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);

  // Specialty filter
  const [specialtyFilter, setSpecialtyFilter] = useState('');

  // Selected appointment for viewing
  const [selectedAppt, setSelectedAppt] = useState(null);

  const navigate = useNavigate();

  const addToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    return id;
  };
  const removeToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const token = localStorage.getItem('token');
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    fetchProfile();
    fetchDoctors();
    fetchAppointments();
    fetchCareTeam();
    fetchPrescriptions();
  }, []);

  const fetchProfile = async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/patient/profile`, { headers });
      if (r.ok) { const d = await r.json(); setPatientInfo(d); }
    } catch {}
  };

  const fetchDoctors = async () => {
    try {
      const params = specialtyFilter ? `?specialty=${encodeURIComponent(specialtyFilter)}` : '';
      const r = await fetch(`${API_BASE_URL}/api/doctor/all${params}`);
      if (r.ok) setDoctors(await r.json());
    } catch {}
  };

  useEffect(() => { fetchDoctors(); }, [specialtyFilter]);

  const fetchAppointments = async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/patient/appointments`, { headers });
      if (r.ok) setAppointments(await r.json());
    } catch {}
  };

  const fetchCareTeam = async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/patient/care-team`, { headers });
      if (r.ok) setCareTeam(await r.json());
    } catch {}
  };

  const fetchPrescriptions = async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/patient/prescriptions`, { headers });
      if (r.ok) setPrescriptions(await r.json());
    } catch {}
  };

  const fetchSlots = async (doctorId, date) => {
    if (!doctorId || !date) return;
    try {
      const r = await fetch(`${API_BASE_URL}/api/appointments/slots?doctorId=${doctorId}&date=${date}`);
      if (r.ok) { const d = await r.json(); setAvailableSlots(d.slots || []); }
    } catch {}
  };

  // ─── Step 1: Select Doctor + Date + Slot ────────────────────────────────────
  const renderStep1 = () => {
    const specialties = [...new Set(doctors.map((d) => d.specialty))].sort();
    const today = new Date().toISOString().split('T')[0];

    return (
      <Card className="max-w-2xl mx-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Calendar className="text-blue-600" size={22} /> Book an Appointment
          </h2>

          {/* Specialty Filter */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Specialty</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={specialtyFilter}
              onChange={(e) => setSpecialtyFilter(e.target.value)}
            >
              <option value="">All Specialties</option>
              {specialties.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Doctor Cards */}
          <div className="mb-4 space-y-2 max-h-64 overflow-y-auto">
            {doctors.map((doc) => (
              <div
                key={doc._id}
                onClick={() => setBookingData((p) => ({ ...p, doctorId: doc._id, startTime: '', endTime: '' }))}
                className={`border rounded-lg p-3 cursor-pointer transition-all ${
                  bookingData.doctorId === doc._id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-900">Dr. {doc.firstName} {doc.lastName}</p>
                    <p className="text-sm text-blue-600">{doc.specialty}</p>
                    {doc.qualification && <p className="text-xs text-gray-500">{doc.qualification} · {doc.experience || 0} yrs exp</p>}
                  </div>
                  {doc.consultationFee > 0 && (
                    <span className="text-sm font-medium text-gray-700">₹{doc.consultationFee}</span>
                  )}
                  {bookingData.doctorId === doc._id && <CheckCircle size={18} className="text-blue-600 shrink-0" />}
                </div>
              </div>
            ))}
            {doctors.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No doctors found.</p>}
          </div>

          {/* Date */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Appointment Date</label>
            <input
              type="date"
              min={today}
              value={bookingData.date}
              onChange={(e) => {
                const date = e.target.value;
                setBookingData((p) => ({ ...p, date, startTime: '', endTime: '' }));
                fetchSlots(bookingData.doctorId, date);
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Available Slots */}
          {bookingData.doctorId && bookingData.date && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Available Time Slots</label>
              {availableSlots.length === 0 ? (
                <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
                  No slots available for this date. The doctor may be on leave or fully booked.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot.startTime}
                      onClick={() => setBookingData((p) => ({ ...p, startTime: slot.startTime, endTime: slot.endTime }))}
                      className={`border rounded-lg py-2 px-3 text-sm font-medium transition-all ${
                        bookingData.startTime === slot.startTime
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-200 text-gray-700 hover:border-blue-400'
                      }`}
                    >
                      {slot.startTime}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <Button
            className="w-full"
            disabled={!bookingData.doctorId || !bookingData.date || !bookingData.startTime}
            onClick={() => setBookingStep(2)}
          >
            Continue to Symptoms <ChevronRight size={16} className="ml-1" />
          </Button>
        </div>
      </Card>
    );
  };

  // ─── Step 2: Symptom Form ────────────────────────────────────────────────────
  const renderStep2 = () => {
    const handleGetAI = async () => {
      if (!symptoms.chiefSymptoms) return;
      setAiLoading(true);
      try {
        const r = await fetch(`${API_BASE_URL}/api/ai/pre-visit-summary`, {
          method: 'POST', headers,
          body: JSON.stringify(symptoms),
        });
        if (r.ok) { const d = await r.json(); setAiPreview(d); }
      } catch {}
      setAiLoading(false);
    };

    const urgencyColor = { Low: 'low', Medium: 'medium', High: 'high' };

    return (
      <Card className="max-w-2xl mx-auto">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => setBookingStep(1)} className="text-gray-400 hover:text-gray-700">←</button>
            <h2 className="text-xl font-bold text-gray-900">Describe Your Symptoms</h2>
          </div>
          <p className="text-sm text-gray-500 mb-6">Help your doctor prepare for your visit by sharing your symptoms in advance.</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Chief Symptoms *</label>
              <textarea
                rows={3}
                placeholder="e.g. Persistent headache, fever, sore throat for 3 days"
                value={symptoms.chiefSymptoms}
                onChange={(e) => setSymptoms((p) => ({ ...p, chiefSymptoms: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                <input
                  type="text"
                  placeholder="e.g. 3 days, 1 week"
                  value={symptoms.duration}
                  onChange={(e) => setSymptoms((p) => ({ ...p, duration: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                <select
                  value={symptoms.severity}
                  onChange={(e) => setSymptoms((p) => ({ ...p, severity: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select severity</option>
                  <option value="mild">Mild</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
              <textarea
                rows={2}
                placeholder="Any other relevant information (e.g. allergies, chronic conditions)"
                value={symptoms.additionalNotes}
                onChange={(e) => setSymptoms((p) => ({ ...p, additionalNotes: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* AI Preview */}
          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={handleGetAI} disabled={aiLoading || !symptoms.chiefSymptoms}>
              <Brain size={14} className="mr-1" />
              {aiLoading ? 'Generating AI Summary...' : 'Preview AI Summary'}
            </Button>
          </div>

          {aiPreview && (
            <div className="mt-4 border border-blue-200 bg-blue-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Brain size={16} className="text-blue-600" />
                <span className="text-sm font-semibold text-blue-900">AI Pre-Visit Summary</span>
                {aiPreview.urgencyLevel && aiPreview.urgencyLevel !== 'Unavailable' && (
                  <Badge type={urgencyColor[aiPreview.urgencyLevel] || 'default'}>
                    {aiPreview.urgencyLevel} Urgency
                  </Badge>
                )}
              </div>
              {aiPreview.chiefComplaint && (
                <p className="text-sm text-gray-700 mb-2">{aiPreview.chiefComplaint}</p>
              )}
              {aiPreview.suggestedQuestions?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1">Suggested questions for your doctor:</p>
                  <ul className="space-y-1">
                    {aiPreview.suggestedQuestions.map((q, i) => (
                      <li key={i} className="text-xs text-gray-600 flex gap-2">
                        <span className="text-blue-400">•</span> {q}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-gray-400 mt-3 border-t border-blue-200 pt-2">
                ⚠️ AI-generated information is intended to assist the healthcare professional and is not a medical diagnosis.
              </p>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={() => { setSymptoms({ chiefSymptoms: '', duration: '', severity: '', additionalNotes: '' }); setBookingStep(3); }}>
              Skip Symptoms
            </Button>
            <Button className="flex-1" onClick={() => setBookingStep(3)} disabled={!symptoms.chiefSymptoms}>
              Continue <ChevronRight size={16} className="ml-1" />
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  // ─── Step 3: Confirm Booking ─────────────────────────────────────────────────
  const renderStep3 = () => {
    const selectedDoctor = doctors.find((d) => d._id === bookingData.doctorId);

    const handleConfirm = async () => {
      setBookingLoading(true);
      try {
        const r = await fetch(`${API_BASE_URL}/api/appointments`, {
          method: 'POST', headers,
          body: JSON.stringify({ ...bookingData, symptoms }),
        });
        const data = await r.json();
        if (r.ok) {
          addToast('Appointment booked successfully! Confirmation email sent.', 'success');
          setBookingStep(1);
          setBookingData({ doctorId: '', date: '', startTime: '', endTime: '' });
          setSymptoms({ chiefSymptoms: '', duration: '', severity: '', additionalNotes: '' });
          setAiPreview(null);
          setAvailableSlots([]);
          fetchAppointments();
          setActiveTab('Dashboard');
        } else if (r.status === 409) {
          addToast(data.message || 'Slot conflict. Please choose another time.', 'error');
          setBookingStep(1);
          fetchSlots(bookingData.doctorId, bookingData.date);
        } else {
          addToast(data.message || 'Booking failed. Please try again.', 'error');
        }
      } catch {
        addToast('Network error. Please try again.', 'error');
      }
      setBookingLoading(false);
    };

    return (
      <Card className="max-w-lg mx-auto">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <button onClick={() => setBookingStep(2)} className="text-gray-400 hover:text-gray-700">←</button>
            <h2 className="text-xl font-bold text-gray-900">Confirm Appointment</h2>
          </div>

          <div className="bg-blue-50 rounded-xl p-4 mb-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Doctor</span><span className="font-medium">Dr. {selectedDoctor?.firstName} {selectedDoctor?.lastName}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Specialty</span><span>{selectedDoctor?.specialty}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Date</span><span className="font-medium">{bookingData.date}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Time</span><span className="font-medium">{bookingData.startTime} – {bookingData.endTime}</span></div>
            {symptoms.chiefSymptoms && <div className="flex justify-between"><span className="text-gray-500">Symptoms</span><span className="text-right max-w-xs">{symptoms.chiefSymptoms}</span></div>}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 mb-4">
            By confirming, you agree that the information provided is accurate. You will receive an email confirmation.
          </div>

          <Button className="w-full" onClick={handleConfirm} disabled={bookingLoading}>
            {bookingLoading ? 'Booking...' : 'Confirm Appointment'}
          </Button>
        </div>
      </Card>
    );
  };

  // ─── Dashboard Tab ──────────────────────────────────────────────────────────
  const renderDashboard = () => {
    const today = new Date().toISOString().split('T')[0];
    const upcoming = appointments.filter((a) => a.date >= today && a.status === 'CONFIRMED');
    const past = appointments.filter((a) => a.date < today || a.status === 'COMPLETED');

    return (
      <div className="space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Upcoming', value: upcoming.length, icon: Calendar, color: 'blue' },
            { label: 'Doctors', value: careTeam.length, icon: Users, color: 'emerald' },
            { label: 'Prescriptions', value: prescriptions.length, icon: FileText, color: 'purple' },
            { label: 'Past Visits', value: past.length, icon: CheckCircle, color: 'gray' },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="p-4">
              <div className={`w-10 h-10 bg-${color}-100 rounded-lg flex items-center justify-center mb-2`}>
                <Icon size={20} className={`text-${color}-600`} />
              </div>
              <div className="text-2xl font-bold text-gray-900">{value}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </Card>
          ))}
        </div>

        {/* Upcoming Appointments */}
        <Card>
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Upcoming Appointments</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {upcoming.length === 0 ? (
              <div className="p-6 text-center">
                <Calendar size={32} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No upcoming appointments.</p>
                <Button size="sm" className="mt-3" onClick={() => setActiveTab('Book')}>Book Now</Button>
              </div>
            ) : upcoming.slice(0, 5).map((appt) => (
              <div key={appt._id} className="p-4 flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900">Dr. {appt.doctorId?.firstName} {appt.doctorId?.lastName}</p>
                  <p className="text-sm text-gray-500">{appt.date} · {appt.startTime}</p>
                  {appt.aiUrgency && appt.aiUrgency !== 'Unavailable' && (
                    <Badge type={appt.aiUrgency.toLowerCase()}>{appt.aiUrgency} Priority</Badge>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  {statusBadge(appt.status)}
                  <button
                    onClick={() => setSelectedAppt(appt)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    View details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Prescriptions */}
        {prescriptions.length > 0 && (
          <Card>
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Active Prescriptions</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {prescriptions.slice(0, 3).map((rx) => (
                <div key={rx._id} className="p-4">
                  <p className="font-medium text-gray-900">{rx.medication || rx.medicines?.map((m) => m.name).join(', ')}</p>
                  <p className="text-sm text-gray-500">
                    {rx.dosage || ''} · {rx.frequency || ''} · Prescribed by Dr. {rx.doctorId?.firstName} {rx.doctorId?.lastName}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    );
  };

  // ─── Appointments Tab ────────────────────────────────────────────────────────
  const renderAppointments = () => (
    <Card>
      <div className="p-4 border-b border-gray-100 flex justify-between items-center">
        <h3 className="font-semibold text-gray-900">All Appointments</h3>
        <Button size="sm" onClick={() => setActiveTab('Book')}>
          <PlusCircle size={14} className="mr-1" /> Book New
        </Button>
      </div>
      <div className="divide-y divide-gray-50">
        {appointments.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">No appointments found.</div>
        ) : appointments.map((appt) => (
          <div key={appt._id} className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium text-gray-900">Dr. {appt.doctorId?.firstName} {appt.doctorId?.lastName}</p>
                <p className="text-sm text-gray-500">{appt.doctorId?.specialty}</p>
                <p className="text-sm text-gray-600 mt-1">{appt.date} · {appt.startTime} – {appt.endTime}</p>
                {appt.aiUrgency && appt.aiUrgency !== 'Unavailable' && (
                  <div className="mt-1"><Badge type={appt.aiUrgency.toLowerCase()}>{appt.aiUrgency} Urgency</Badge></div>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                {statusBadge(appt.status)}
                <button onClick={() => setSelectedAppt(appt)} className="text-xs text-blue-600 hover:underline">Details</button>
              </div>
            </div>
            {/* Post-visit summary */}
            {appt.aiPostVisitSummary && appt.status === 'COMPLETED' && (() => {
              try {
                const summary = JSON.parse(appt.aiPostVisitSummary);
                return (
                  <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-emerald-800 mb-1">📋 Visit Summary</p>
                    <p className="text-xs text-emerald-700">{summary.summary}</p>
                  </div>
                );
              } catch { return null; }
            })()}
          </div>
        ))}
      </div>
    </Card>
  );

  // ─── Appointment Detail Modal ─────────────────────────────────────────────────
  const renderApptModal = () => {
    if (!selectedAppt) return null;
    let postSummary = null;
    if (selectedAppt.aiPostVisitSummary) {
      try { postSummary = JSON.parse(selectedAppt.aiPostVisitSummary); } catch {}
    }

    const handleCancel = async () => {
      if (!confirm('Are you sure you want to cancel this appointment?')) return;
      try {
        const r = await fetch(`${API_BASE_URL}/api/appointments/${selectedAppt._id}`, { method: 'DELETE', headers });
        if (r.ok) {
          addToast('Appointment cancelled.', 'info');
          setSelectedAppt(null);
          fetchAppointments();
        }
      } catch { addToast('Cancel failed.', 'error'); }
    };

    return (
      <Modal isOpen={!!selectedAppt} onClose={() => setSelectedAppt(null)} title="Appointment Details">
        <div className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Doctor</span><span className="font-medium">Dr. {selectedAppt.doctorId?.firstName} {selectedAppt.doctorId?.lastName}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Date</span><span>{selectedAppt.date}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Time</span><span>{selectedAppt.startTime} – {selectedAppt.endTime}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Status</span><span>{statusBadge(selectedAppt.status)}</span></div>
          {selectedAppt.symptoms?.chiefSymptoms && (
            <div><span className="text-gray-500">Symptoms: </span>{selectedAppt.symptoms.chiefSymptoms}</div>
          )}
          {selectedAppt.aiPreVisitSummary && (
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-800 mb-1">🤖 AI Pre-Visit Summary</p>
              <p className="text-xs text-blue-700">{selectedAppt.aiPreVisitSummary}</p>
              {selectedAppt.aiUrgency && selectedAppt.aiUrgency !== 'Unavailable' && (
                <Badge type={selectedAppt.aiUrgency.toLowerCase()} className="mt-2">{selectedAppt.aiUrgency} Urgency</Badge>
              )}
            </div>
          )}
          {postSummary && (
            <div className="bg-emerald-50 rounded-lg p-3">
              <p className="text-xs font-semibold text-emerald-800 mb-1">📋 Post-Visit Summary</p>
              <p className="text-xs text-emerald-700">{postSummary.summary}</p>
              {postSummary.followUpSteps?.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium">Follow-up:</p>
                  <ul>{postSummary.followUpSteps.map((s, i) => <li key={i} className="text-xs text-emerald-700">• {s}</li>)}</ul>
                </div>
              )}
              <p className="text-xs text-gray-400 mt-2">⚠️ This summary is not a medical diagnosis. Always follow your doctor's guidance.</p>
            </div>
          )}
          {['CONFIRMED', 'HELD'].includes(selectedAppt.status) && (
            <Button variant="danger" size="sm" className="w-full mt-4" onClick={handleCancel}>
              Cancel Appointment
            </Button>
          )}
        </div>
      </Modal>
    );
  };

  // ─── Navigation ───────────────────────────────────────────────────────────────
  const navItems = [
    { id: 'Dashboard', icon: Home, label: 'Dashboard' },
    { id: 'Book', icon: PlusCircle, label: 'Book Appointment' },
    { id: 'Appointments', icon: Calendar, label: 'My Appointments' },
    { id: 'Profile', icon: UserCircle, label: 'Profile' },
  ];

  const renderProfile = () => (
    <Card className="max-w-lg mx-auto p-6">
      <h2 className="text-xl font-bold mb-4">My Profile</h2>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between"><span className="text-gray-500">Name</span><span>{patientInfo?.firstName} {patientInfo?.lastName}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Email</span><span>{patientInfo?.email}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Role</span><Badge type="info">Patient</Badge></div>
      </div>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toasts */}
      {toasts.map((t) => <Toast key={t.id} {...t} onClose={() => removeToast(t.id)} />)}

      {/* Appointment Detail Modal */}
      {renderApptModal()}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Hospital size={24} className="text-blue-600" />
            <span className="font-bold text-xl text-gray-900">Medicare</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 hidden sm:block">
              Welcome, {patientInfo?.firstName}
            </span>
            <Button variant="outline" size="sm" onClick={() => { localStorage.removeItem('token'); navigate('/'); }}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 flex gap-6">
        {/* Sidebar */}
        <aside className="hidden md:block w-48 shrink-0">
          <nav className="space-y-1">
            {navItems.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon size={18} /> {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Mobile Nav */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 flex">
          {navItems.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex flex-col items-center py-2 text-xs gap-1 ${
                activeTab === id ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              <Icon size={20} />
              <span className="truncate">{label.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        {/* Main Content */}
        <main className="flex-1 pb-20 md:pb-0">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            {activeTab === 'Dashboard' ? `Welcome, ${patientInfo?.firstName || 'Patient'}` : activeTab}
          </h1>

          {activeTab === 'Dashboard' && renderDashboard()}
          {activeTab === 'Book' && (
            <>
              {bookingStep === 1 && renderStep1()}
              {bookingStep === 2 && renderStep2()}
              {bookingStep === 3 && renderStep3()}
            </>
          )}
          {activeTab === 'Appointments' && renderAppointments()}
          {activeTab === 'Profile' && renderProfile()}
        </main>
      </div>
    </div>
  );
}