import React, { useState, useEffect } from 'react';
import {
  Calendar, FileText, Users, Home, UserCircle, Hospital, Stethoscope,
  Activity, UserPlus, ShieldCheck, Eye, EyeOff, X, AlertTriangle,
  Clock, Trash2, PlusCircle, Bell, ChevronDown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config.js';

// ─── Shared Components ────────────────────────────────────────────────────────
const Button = ({ children, variant = 'primary', size = 'md', className = '', disabled, ...props }) => {
  const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' };
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50',
    ghost: 'text-gray-600 hover:bg-gray-100',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
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
    danger: 'bg-red-100 text-red-700',
  };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[type] || styles.default}`}>{children}</span>;
};

const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, []);
  const styles = { success: 'bg-emerald-600', error: 'bg-red-600', info: 'bg-blue-600', warning: 'bg-amber-600' };
  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg text-white shadow-lg ${styles[type] || styles.info} max-w-sm`}>
      <span className="text-sm">{message}</span>
      <button onClick={onClose}><X size={16} /></button>
    </div>
  );
};

const Input = ({ label, ...props }) => (
  <div>
    {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
    <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" {...props} />
  </div>
);

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [adminInfo, setAdminInfo] = useState(null);
  const [totalDoctors, setTotalDoctors] = useState(0);
  const [totalPatients, setTotalPatients] = useState(0);
  const [doctorOverview, setDoctorOverview] = useState([]);
  const [patientOverview, setPatientOverview] = useState([]);
  const [allDoctors, setAllDoctors] = useState([]);
  const [allAppointments, setAllAppointments] = useState([]);
  const [failedNotifications, setFailedNotifications] = useState([]);
  const [toasts, setToasts] = useState([]);

  // Doctor leave
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [doctorLeaves, setDoctorLeaves] = useState([]);
  const [leaveLoading, setLeaveLoading] = useState(false);

  // Slot duration
  const [slotDoctorId, setSlotDoctorId] = useState('');
  const [slotDuration, setSlotDuration] = useState(30);

  // Add doctor form
  const [doctorData, setDoctorData] = useState({ firstName: '', lastName: '', email: '', specialty: '', licenseNumber: '', phoneNumber: '', password: '', qualification: 'MBBS', experience: 0, consultationFee: 0 });
  const [showPassword, setShowPassword] = useState(false);

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
    fetchAdminProfile();
    fetchTotalDoctors();
    fetchTotalPatients();
    fetchDoctorOverview();
    fetchPatientOverview();
    fetchAllDoctors();
    fetchAllAppointments();
    fetchFailedNotifications();
  }, []);

  useEffect(() => {
    if (selectedDoctorId) fetchDoctorLeaves(selectedDoctorId);
  }, [selectedDoctorId]);

  const fetchAdminProfile = async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/admin/profile`, { headers });
      if (r.ok) { const d = await r.json(); setAdminInfo(d); }
      else { navigate('/login'); }
    } catch {}
  };

  const fetchAllDoctors = async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/admin/doctors`, { headers });
      if (r.ok) setAllDoctors(await r.json());
    } catch {}
  };

  const fetchTotalDoctors = async () => {
    try { const r = await fetch(`${API_BASE_URL}/api/admin/total-doctors`, { headers }); if (r.ok) { const d = await r.json(); setTotalDoctors(d.totalDoctors); } } catch {}
  };
  const fetchTotalPatients = async () => {
    try { const r = await fetch(`${API_BASE_URL}/api/admin/total-patients`, { headers }); if (r.ok) { const d = await r.json(); setTotalPatients(d.totalPatients); } } catch {}
  };
  const fetchDoctorOverview = async () => {
    try { const r = await fetch(`${API_BASE_URL}/api/admin/doctor-overview`, { headers }); if (r.ok) setDoctorOverview(await r.json()); } catch {}
  };
  const fetchPatientOverview = async () => {
    try { const r = await fetch(`${API_BASE_URL}/api/admin/patient-overview`, { headers }); if (r.ok) setPatientOverview(await r.json()); } catch {}
  };
  const fetchAllAppointments = async () => {
    try { const r = await fetch(`${API_BASE_URL}/api/admin/appointments`, { headers }); if (r.ok) setAllAppointments(await r.json()); } catch {}
  };
  const fetchFailedNotifications = async () => {
    try { const r = await fetch(`${API_BASE_URL}/api/admin/notifications/failed`, { headers }); if (r.ok) setFailedNotifications(await r.json()); } catch {}
  };

  const fetchDoctorLeaves = async (doctorId) => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/admin/doctors/${doctorId}/leave`, { headers });
      if (r.ok) setDoctorLeaves(await r.json());
    } catch {}
  };

  // ─── Dashboard ─────────────────────────────────────────────────────────────────
  const renderDashboard = () => {
    const occupancy = totalPatients > 0 ? Math.min(((totalPatients / 10000) * 100).toFixed(1), 100) : 0;
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Doctors', value: totalDoctors, icon: Stethoscope, color: 'blue' },
            { label: 'Patients', value: totalPatients, icon: Users, color: 'emerald' },
            { label: 'Appointments', value: allAppointments.length, icon: Calendar, color: 'purple' },
            { label: 'Failed Emails', value: failedNotifications.length, icon: Bell, color: failedNotifications.length > 0 ? 'red' : 'gray' },
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

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <div className="p-4 border-b border-gray-100"><h3 className="font-semibold">Doctor Overview</h3></div>
            <div className="divide-y divide-gray-50">
              {doctorOverview.slice(0, 5).map((d, i) => (
                <div key={i} className="p-3 flex justify-between items-center text-sm">
                  <div><p className="font-medium">{d.name}</p><p className="text-xs text-gray-500">{d.specialty}</p></div>
                  <Badge type="info">{d.patients} patients</Badge>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <div className="p-4 border-b border-gray-100"><h3 className="font-semibold">Recent Appointments</h3></div>
            <div className="divide-y divide-gray-50">
              {allAppointments.slice(0, 5).map((a) => (
                <div key={a._id} className="p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{a.patientId?.firstName} {a.patientId?.lastName}</span>
                    <Badge type={a.status === 'CONFIRMED' ? 'success' : a.status === 'CANCELLED' ? 'danger' : 'default'}>{a.status}</Badge>
                  </div>
                  <p className="text-xs text-gray-500">Dr. {a.doctorId?.firstName} · {a.date}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    );
  };

  // ─── Add Doctor ─────────────────────────────────────────────────────────────
  const renderAddDoctor = () => {
    const specialties = ['Cardiology', 'Neurology', 'Pediatrics', 'Oncology', 'Orthopedics', 'Dermatology', 'Gynecology', 'Psychiatry', 'General Medicine', 'ENT', 'Ophthalmology', 'Urology'];

    const handleSubmit = async (e) => {
      e.preventDefault();
      try {
        const r = await fetch(`${API_BASE_URL}/api/admin/add-doctor`, { method: 'POST', headers, body: JSON.stringify(doctorData) });
        if (r.ok) {
          addToast('Doctor added successfully!', 'success');
          setDoctorData({ firstName: '', lastName: '', email: '', specialty: '', licenseNumber: '', phoneNumber: '', password: '', qualification: 'MBBS', experience: 0, consultationFee: 0 });
          fetchTotalDoctors();
          fetchAllDoctors();
        } else {
          const d = await r.json();
          addToast(d.error || 'Failed to add doctor.', 'error');
        }
      } catch { addToast('Network error.', 'error'); }
    };

    return (
      <Card className="max-w-2xl mx-auto p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Add New Doctor</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" required value={doctorData.firstName} onChange={(e) => setDoctorData((p) => ({ ...p, firstName: e.target.value }))} />
            <Input label="Last Name" required value={doctorData.lastName} onChange={(e) => setDoctorData((p) => ({ ...p, lastName: e.target.value }))} />
          </div>
          <Input label="Email" type="email" required value={doctorData.email} onChange={(e) => setDoctorData((p) => ({ ...p, email: e.target.value }))} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Specialty</label>
            <select required value={doctorData.specialty} onChange={(e) => setDoctorData((p) => ({ ...p, specialty: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
              <option value="">Choose specialty</option>
              {specialties.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Qualification" value={doctorData.qualification} onChange={(e) => setDoctorData((p) => ({ ...p, qualification: e.target.value }))} />
            <Input label="Experience (years)" type="number" min="0" value={doctorData.experience} onChange={(e) => setDoctorData((p) => ({ ...p, experience: parseInt(e.target.value) || 0 }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="License Number" required value={doctorData.licenseNumber} onChange={(e) => setDoctorData((p) => ({ ...p, licenseNumber: e.target.value }))} />
            <Input label="Phone Number" type="tel" required value={doctorData.phoneNumber} onChange={(e) => setDoctorData((p) => ({ ...p, phoneNumber: e.target.value }))} />
          </div>
          <Input label="Consultation Fee (₹)" type="number" min="0" value={doctorData.consultationFee} onChange={(e) => setDoctorData((p) => ({ ...p, consultationFee: parseInt(e.target.value) || 0 }))} />
          <div className="relative">
            <Input label="Password" type={showPassword ? 'text' : 'password'} required value={doctorData.password} onChange={(e) => setDoctorData((p) => ({ ...p, password: e.target.value }))} />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-7 text-gray-400 hover:text-gray-600">
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <Button type="submit" className="w-full">Add Doctor</Button>
        </form>
      </Card>
    );
  };

  // ─── Doctor Leave Management ───────────────────────────────────────────────────
  const renderLeaveManagement = () => {
    const today = new Date().toISOString().split('T')[0];

    const handleAddLeave = async (e) => {
      e.preventDefault();
      if (!selectedDoctorId || !leaveDate) { addToast('Select doctor and date.', 'error'); return; }
      setLeaveLoading(true);
      try {
        const r = await fetch(`${API_BASE_URL}/api/admin/doctors/${selectedDoctorId}/leave`, {
          method: 'POST', headers,
          body: JSON.stringify({ date: leaveDate, reason: leaveReason }),
        });
        const data = await r.json();
        if (r.ok) {
          addToast(data.message, data.affectedCount > 0 ? 'warning' : 'success');
          setLeaveDate('');
          setLeaveReason('');
          fetchDoctorLeaves(selectedDoctorId);
          fetchAllAppointments();
        } else if (r.status === 409) {
          addToast('Leave already exists for this date.', 'error');
        } else {
          addToast(data.error || 'Failed.', 'error');
        }
      } catch { addToast('Network error.', 'error'); }
      setLeaveLoading(false);
    };

    const handleRemoveLeave = async (date) => {
      if (!confirm(`Remove leave for ${date}?`)) return;
      try {
        await fetch(`${API_BASE_URL}/api/admin/doctors/${selectedDoctorId}/leave/${date}`, { method: 'DELETE', headers });
        addToast('Leave removed. Slot is now available.', 'success');
        fetchDoctorLeaves(selectedDoctorId);
      } catch {}
    };

    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Card className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="text-blue-600" size={22} /> Doctor Leave Management
          </h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Doctor</label>
            <select
              value={selectedDoctorId}
              onChange={(e) => setSelectedDoctorId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose a doctor</option>
              {allDoctors.map((d) => <option key={d._id} value={d._id}>Dr. {d.firstName} {d.lastName} — {d.specialty}</option>)}
            </select>
          </div>

          <form onSubmit={handleAddLeave} className="space-y-3">
            <Input label="Leave Date" type="date" min={today} value={leaveDate} onChange={(e) => setLeaveDate(e.target.value)} required />
            <Input label="Reason (optional)" placeholder="e.g. Personal leave, conference" value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} />
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              ⚠️ Adding leave will CANCEL all confirmed appointments on this date and notify affected patients.
            </div>
            <Button type="submit" className="w-full" disabled={!selectedDoctorId || leaveLoading}>
              {leaveLoading ? 'Processing...' : 'Add Leave & Notify Patients'}
            </Button>
          </form>
        </Card>

        {/* Existing Leaves */}
        {selectedDoctorId && (
          <Card>
            <div className="p-4 border-b border-gray-100"><h3 className="font-semibold">Scheduled Leaves</h3></div>
            <div className="divide-y divide-gray-50">
              {doctorLeaves.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">No leave days scheduled.</p>
              ) : doctorLeaves.map((lv) => (
                <div key={lv._id} className="p-4 flex justify-between items-center text-sm">
                  <div>
                    <p className="font-medium">{lv.date}</p>
                    {lv.reason && <p className="text-xs text-gray-500">{lv.reason}</p>}
                  </div>
                  <Button variant="danger" size="sm" onClick={() => handleRemoveLeave(lv.date)}>
                    <Trash2 size={14} className="mr-1" /> Remove
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    );
  };

  // ─── Slot Duration Config ─────────────────────────────────────────────────────
  const renderSlotConfig = () => {
    const handleSetSlotDuration = async () => {
      if (!slotDoctorId) { addToast('Select a doctor.', 'error'); return; }
      try {
        const r = await fetch(`${API_BASE_URL}/api/admin/doctors/${slotDoctorId}/slot-duration`, {
          method: 'PUT', headers,
          body: JSON.stringify({ slotDurationMinutes: slotDuration }),
        });
        if (r.ok) { addToast('Slot duration updated!', 'success'); fetchAllDoctors(); }
        else { const d = await r.json(); addToast(d.error || 'Failed.', 'error'); }
      } catch { addToast('Error.', 'error'); }
    };

    return (
      <Card className="max-w-lg mx-auto p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="text-blue-600" size={22} /> Slot Duration Configuration
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Doctor</label>
            <select value={slotDoctorId} onChange={(e) => { setSlotDoctorId(e.target.value); const doc = allDoctors.find((d) => d._id === e.target.value); if (doc) setSlotDuration(doc.slotDurationMinutes || 30); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
              <option value="">Choose a doctor</option>
              {allDoctors.map((d) => <option key={d._id} value={d._id}>Dr. {d.firstName} {d.lastName} — {d.specialty}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Slot Duration</label>
            <div className="grid grid-cols-5 gap-2">
              {[15, 20, 30, 45, 60].map((min) => (
                <button key={min} onClick={() => setSlotDuration(min)}
                  className={`border rounded-lg py-2 text-sm font-medium transition-all ${slotDuration === min ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-700 hover:border-blue-400'}`}>
                  {min} min
                </button>
              ))}
            </div>
          </div>
          <Button className="w-full" onClick={handleSetSlotDuration}>Update Slot Duration</Button>
        </div>
      </Card>
    );
  };

  // ─── All Appointments View ────────────────────────────────────────────────────
  const renderAppointments = () => (
    <Card>
      <div className="p-4 border-b border-gray-100 flex justify-between items-center">
        <h3 className="font-semibold text-gray-900">All Appointments</h3>
        <Button size="sm" variant="outline" onClick={fetchAllAppointments}>Refresh</Button>
      </div>
      <div className="divide-y divide-gray-50">
        {allAppointments.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500">No appointments found.</p>
        ) : allAppointments.map((a) => (
          <div key={a._id} className="p-4 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">{a.patientId?.firstName} {a.patientId?.lastName}</span>
              <Badge type={a.status === 'CONFIRMED' ? 'success' : a.status === 'CANCELLED' ? 'danger' : a.status === 'COMPLETED' ? 'info' : 'warning'}>{a.status}</Badge>
            </div>
            <p className="text-gray-500 text-xs">Dr. {a.doctorId?.firstName} {a.doctorId?.lastName} · {a.doctorId?.specialty}</p>
            <p className="text-gray-500 text-xs">{a.date} · {a.startTime}</p>
          </div>
        ))}
      </div>
    </Card>
  );

  // ─── Failed Notifications ─────────────────────────────────────────────────────
  const renderNotifications = () => (
    <Card>
      <div className="p-4 border-b border-gray-100 flex justify-between items-center">
        <h3 className="font-semibold text-gray-900">Failed Email Notifications</h3>
        <Button size="sm" variant="outline" onClick={fetchFailedNotifications}>Refresh</Button>
      </div>
      <div className="divide-y divide-gray-50">
        {failedNotifications.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">✅ No failed notifications.</div>
        ) : failedNotifications.map((n) => (
          <div key={n._id} className="p-4 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">{n.type}</span>
              <Badge type="danger">Attempts: {n.retryCount}/{n.maxRetries}</Badge>
            </div>
            <p className="text-gray-500 text-xs">{n.toEmail} · {n.subject}</p>
            {n.errorMessage && <p className="text-red-500 text-xs mt-1">{n.errorMessage}</p>}
            <p className="text-gray-400 text-xs">{new Date(n.createdAt).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </Card>
  );

  // ─── Doctors Management List ──────────────────────────────────────────────────
  const renderDoctorsList = () => (
    <Card>
      <div className="p-4 border-b border-gray-100"><h3 className="font-semibold text-gray-900">All Doctors</h3></div>
      <div className="divide-y divide-gray-50">
        {allDoctors.map((d) => (
          <div key={d._id} className="p-4 flex justify-between items-center text-sm">
            <div>
              <p className="font-medium">Dr. {d.firstName} {d.lastName}</p>
              <p className="text-xs text-gray-500">{d.specialty} · {d.qualification} · {d.experience || 0} yrs</p>
              <p className="text-xs text-gray-500">Slot: {d.slotDurationMinutes || 30} min · Fee: ₹{d.consultationFee || 0}</p>
            </div>
            <Badge type={d.isActive !== false ? 'success' : 'danger'}>{d.isActive !== false ? 'Active' : 'Inactive'}</Badge>
          </div>
        ))}
      </div>
    </Card>
  );

  // ─── Profile Management ───────────────────────────────────────────────────────
  const renderProfile = () => {
    const [profileData, setProfileData] = useState({
      firstName: adminInfo?.firstName || '',
      lastName: adminInfo?.lastName || '',
      email: adminInfo?.email || '',
      phone: adminInfo?.phone || ''
    });
    const [profileLoading, setProfileLoading] = useState(false);

    useEffect(() => {
      if (adminInfo) setProfileData({ firstName: adminInfo.firstName, lastName: adminInfo.lastName, email: adminInfo.email, phone: adminInfo.phone || '' });
    }, [adminInfo]);

    const handleProfileUpdate = async (e) => {
      e.preventDefault();
      setProfileLoading(true);
      try {
        const r = await fetch(`${API_BASE_URL}/api/admin/profile`, {
          method: 'PUT', headers,
          body: JSON.stringify(profileData),
        });
        const d = await r.json();
        if (r.ok) {
          addToast('Profile updated successfully!', 'success');
          setAdminInfo(d.admin);
        } else {
          addToast(d.error || 'Failed to update profile.', 'error');
        }
      } catch { addToast('Network error.', 'error'); }
      setProfileLoading(false);
    };

    return (
      <Card className="max-w-xl mx-auto p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <UserCircle className="text-blue-600" size={22} /> Profile Settings
        </h2>
        <form onSubmit={handleProfileUpdate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" required value={profileData.firstName} onChange={(e) => setProfileData((p) => ({ ...p, firstName: e.target.value }))} />
            <Input label="Last Name" required value={profileData.lastName} onChange={(e) => setProfileData((p) => ({ ...p, lastName: e.target.value }))} />
          </div>
          <Input label="Email" type="email" required value={profileData.email} onChange={(e) => setProfileData((p) => ({ ...p, email: e.target.value }))} />
          <Input label="Phone Number" type="tel" value={profileData.phone} onChange={(e) => setProfileData((p) => ({ ...p, phone: e.target.value }))} />
          <Button type="submit" className="w-full" disabled={profileLoading}>
            {profileLoading ? 'Updating...' : 'Save Profile'}
          </Button>
        </form>
      </Card>
    );
  };

  const navItems = [
    { id: 'Dashboard',     icon: Home,        label: 'Dashboard' },
    { id: 'Add Doctor',    icon: UserPlus,    label: 'Add Doctor' },
    { id: 'Doctors',       icon: Stethoscope, label: 'Doctors' },
    { id: 'Leave',         icon: Calendar,    label: 'Leave Mgmt' },
    { id: 'Slots',         icon: Clock,       label: 'Slot Config' },
    { id: 'Appointments',  icon: FileText,    label: 'Appointments' },
    { id: 'Notifications', icon: Bell,        label: 'Notifications' },
    { id: 'Profile',       icon: UserCircle,  label: 'Profile' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {toasts.map((t) => <Toast key={t.id} {...t} onClose={() => removeToast(t.id)} />)}

      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Hospital size={24} className="text-blue-600" />
            <span className="font-bold text-xl text-gray-900">Medicare</span>
            <span className="hidden sm:inline text-sm text-gray-400">/ Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 hidden sm:block">{adminInfo?.firstName} {adminInfo?.lastName}</span>
            <Button variant="outline" size="sm" onClick={() => { localStorage.removeItem('token'); navigate('/'); }}>Sign Out</Button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 flex gap-6">
        <aside className="hidden md:block w-52 shrink-0">
          <nav className="space-y-1">
            {navItems.map(({ id, icon: Icon, label }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                <Icon size={18} /> {label}
                {id === 'Notifications' && failedNotifications.length > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{failedNotifications.length}</span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            {activeTab === 'Dashboard' ? `Welcome, ${adminInfo?.firstName || 'Admin'}` : activeTab.replace('Add ', 'Add New ')}
          </h1>
          {activeTab === 'Dashboard'     && renderDashboard()}
          {activeTab === 'Add Doctor'    && renderAddDoctor()}
          {activeTab === 'Doctors'       && renderDoctorsList()}
          {activeTab === 'Leave'         && renderLeaveManagement()}
          {activeTab === 'Slots'         && renderSlotConfig()}
          {activeTab === 'Appointments'  && renderAppointments()}
          {activeTab === 'Notifications' && renderNotifications()}
          {activeTab === 'Profile'       && renderProfile()}
        </main>
      </div>
    </div>
  );
}