import React from 'react';
import { Calendar, Clipboard, Cog, HeartPulse, Hospital, Shield, User, Users,Watch } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Button = ({ children, primary, onClick, ...props }) => (
  <button
    className={`inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
      primary
        ? 'text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
        : 'text-gray-700 bg-white hover:bg-gray-50 focus:ring-blue-500'
    }`}
    onClick={onClick}
    {...props}
  >
    {children}
  </button>
);

const Card = ({ icon: Icon, title, description, primary }) => (
  <div className={`rounded-lg shadow-md p-6 ${primary ? 'bg-white' : 'bg-gray-100'}`}>
    <Icon className="w-8 h-8 text-blue-600 mb-4" />
    <h3 className="text-xl font-bold mb-2">{title}</h3>
    <p className="text-gray-600 mb-4">{description}</p>
    {/* <Button primary>Explore</Button> */}
  </div>
);

const Section = ({ children, bg, height }) => (
  <section className={`${height || 'py-20'} ${bg} content-center`}>
    <div className="container mx-auto px-4 h-full">
      {children}
    </div>
  </section>
);

const Home = () => {
  const navigate = useNavigate();

  const handleButtonClick = (route) => {
    navigate(route);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex items-center justify-between px-6 py-4 bg-white">
        <div className="flex items-center gap-2">
          <Hospital className="w-8 h-8 text-blue-600" />
          <span className="text-3xl font-bold">DOCTOR-MEDS</span>
        </div>
        <nav className="flex items-center gap-4">
          <Button primary onClick={() => handleButtonClick('/login')}>Login</Button>
          <Button onClick={() => handleButtonClick('/signup')}>Sign Up</Button>
        </nav>
      </header>
      
      <main className="flex-1">
      <Section bg="bg-blue-600" height="min-h-[23rem]">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center h-full">
    <div>
      <h1 className="text-5xl font-bold text-white mb-6 text-left">
        Streamline Your Health Journey
      </h1>
      <p className="text-xl text-white mb-10 text-left">
        DOCTOR-MEDS system helps you optimize patient care, organizing medical records with ease, and improving overall efficiency.
      </p>

      {/* Buttons Container */}
      <div className="flex gap-4 justify-left">
        <Button onClick={() => handleButtonClick('/predict')}>Disease Prediction</Button>
        <Button onClick={() => handleButtonClick('/login')}>Appointments</Button>
      </div>
    </div>
    
    <div className="bg-gray-200 w-full h-full min-h-[20rem] rounded-lg overflow-hidden">
      <img src="home-5.gif" alt="" />
    </div>
  </div>
</Section>


        <Section>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: User, title: "Patient", description: "Efficiently manage patient records, appointments, and medical history." },
              { icon: Hospital, title: "Doctor", description: "Manage doctor profiles, schedules, and patient assignments." },
              { icon: Calendar, title: "Appointment Scheduling", description: "Streamline appointment booking and management for patients and doctors." }
            ].map((card, index) => (
              <Card key={index} {...card} primary />
            ))}
          </div>
        </Section>

        <Section bg="bg-gray-100" height="min-h-[25rem]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="bg-gray-200 w-full h-64 min-h-[18rem] rounded-lg overflow-hidden flex justify-center items-center">
              <img src="home-6.gif" alt="" className='w-full'/>
            </div>
            <div>
              <h2 className="text-3xl font-bold mb-4 text-left">Patient Care from registration and disease prediction to follow-up</h2>
              <p className="text-xl text-gray-600 mb-8 text-left">
                DOCTOR-MEDS system provides cutting-edge features to streamline your workflows, improve
                patient satisfaction, and drive better outcomes.
              </p>
              <div className="flex gap-4 justify-left">
                <Button primary onClick={() => handleButtonClick('/login')}>Get Started</Button>
                <Button onClick={() => handleButtonClick('/login')}>Appointments</Button>
              </div>
            </div>
          </div>
        </Section>

        <Section>
          <h2 className="text-3xl font-bold mb-12 text-center">
            DOCTOR-MEDS INCLUDES
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Clipboard, title: "Improved Efficiency", description: "Our system streamlines administrative tasks, reducing paperwork and improving overall hospital efficiency." },
              { icon: Users, title: "Enhanced Patient Care", description: "With comprehensive patient records and intelligent scheduling, our system helps you provide better care to your patients." },
              { icon: Watch, title: "Time Savings", description: "Our system helps you optimize operations and reduce overhead time, leading to significant time saving." },
              { icon: HeartPulse, title: "Improved Patient Outcomes", description: "By streamlining processes and enhancing patient care, our system helps you improve overall patient outcomes and satisfaction." },
              { icon: Shield, title: "Secure Data", description: "Our system ensures the security and confidentiality of all patient data, with robust encryption and access controls." },
              { icon: Cog, title: "Customizable Solutions", description: "Our system is highly configurable, allowing you to tailor it to your specific hospital's needs and workflows." },
            ].map((card, index) => (
              <Card key={index} {...card} />
            ))}
          </div>
        </Section>
      </main>

      <footer className="bg-white py-6 border-t">

      <div className="footer bg-gray-800 text-white py-6 px-4">
  <div className="container mx-auto text-center">
    {/* Description */}
    <p className="text-lg mb-4">
      Your trusted source for reliable health information and services.
    </p>
    
    {/* Contact Information */}
    <div className="flex justify-center space-x-8 mb-4">
      {/* Phone Number */}
      <div className="flex items-center">
        <span className="mr-2">📞</span>
        <span>(+91) 93698-15998</span>
      </div>

      {/* Email */}
      <div className="flex items-center">
        <span className="mr-2">📧</span>
        <span>krishnam@gmail.com</span>
      </div>

      {/* Location */}
      <div className="flex items-center">
        <span className="mr-2">📍</span>
        <span>VIT Bhopal University, Kothri Kalan, M.P, 466114</span>
      </div>
    </div>

    {/* Footer Note */}
    <p className="text-sm">
    DOCTOR-MEDS, inc, &copy; 2024, All rights reserved.
    </p>
  </div>
</div>

        
        
      </footer>
    </div>
  );
}

export default Home;