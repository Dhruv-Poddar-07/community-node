import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { SKILLS } from '../constants/skills';

export default function WorkingLogin() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'staff' | 'volunteer'>('volunteer');
  const [city, setCity] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (isLogin) {
      // Handle login with API
      try {
        await login(email, password);
        // Navigation will be handled by AuthContext
      } catch (error) {
        setError('Invalid email or password');
      } finally {
        setLoading(false);
      }
    } else {
      // Handle registration with API
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }
      
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        setLoading(false);
        return;
      }
      
      // Validate required fields for volunteer
      if (role === 'volunteer') {
        if (!city.trim()) {
          setError('City is required for volunteer registration');
          setLoading(false);
          return;
        }
        
        if (selectedSkills.length === 0) {
          setError('At least one skill must be selected for volunteer registration');
          setLoading(false);
          return;
        }
      }
      
      try {
        await register({
          username: email.split('@')[0], // Use email prefix as username
          email,
          password,
          name,
          phone,
          role,
          city: role === 'volunteer' ? city : undefined,
          skills: role === 'volunteer' ? selectedSkills : undefined
        });
        // Navigation will be handled by AuthContext
      } catch (error: any) {
        console.error('Registration error:', error);
        setError(error?.message || 'Registration failed. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 50%, #15803d 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: 'Arial, sans-serif',
      position: 'relative'
    }}>
      {/* Ambient color overlays */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(circle at 20% 50%, rgba(34, 197, 94, 0.1) 0%, transparent 50%)',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(circle at 80% 80%, rgba(21, 128, 61, 0.1) 0%, transparent 50%)',
        pointerEvents: 'none'
      }} />
      
      <div style={{
        background: 'rgba(255, 255, 255, 0.98)',
        padding: '40px',
        borderRadius: '16px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.1), 0 0 0 1px rgba(255, 255, 255, 0.2)',
        width: '100%',
        maxWidth: '400px',
        backdropFilter: 'blur(10px)',
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{
            width: '60px',
            height: '60px',
            background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '20px',
            boxShadow: '0 8px 16px rgba(34, 197, 94, 0.3)'
          }}>
            CN
          </div>
          <h1 style={{ color: '#1a202c', marginBottom: '10px', fontSize: '24px', fontWeight: '600' }}>Community Node</h1>
          <p style={{ color: '#4b5563', fontSize: '14px', lineHeight: '1.5' }}>Connecting NGOs with volunteers across India</p>
        </div>

        <div style={{ display: 'flex', marginBottom: '20px', background: 'linear-gradient(135deg, #f9fafb 0%, #e5e7eb 100%)', borderRadius: '8px', padding: '4px', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }}>
          <button
            type="button"
            onClick={() => setIsLogin(true)}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              borderRadius: '6px',
              background: isLogin ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' : 'transparent',
              color: isLogin ? 'white' : '#374151',
              fontWeight: isLogin ? '600' : '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: isLogin ? '0 2px 4px rgba(34, 197, 94, 0.2)' : 'none'
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setIsLogin(false)}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              borderRadius: '6px',
              background: !isLogin ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' : 'transparent',
              color: !isLogin ? 'white' : '#374151',
              fontWeight: !isLogin ? '600' : '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: !isLogin ? '0 2px 4px rgba(34, 197, 94, 0.2)' : 'none'
            }}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {!isLogin && (
            <div>
              <label style={{ display: 'block', marginBottom: '5px', color: '#374151', fontWeight: '500' }}>
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={!isLogin}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  background: '#fafafa',
                  transition: 'all 0.2s ease'
                }}
                placeholder="Enter your full name"
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: '#374151', fontWeight: '500' }}>
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                boxSizing: 'border-box',
                background: '#fafafa',
                transition: 'all 0.2s ease'
              }}
              placeholder="Enter your email"
            />
          </div>

          {!isLogin && (
            <div>
              <label style={{ display: 'block', marginBottom: '5px', color: '#374151', fontWeight: '500' }}>
                Phone Number (Optional)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  background: '#fafafa',
                  transition: 'all 0.2s ease'
                }}
                placeholder="Enter your phone number"
              />
            </div>
          )}

          {!isLogin && role === 'volunteer' && (
            <div>
              <label style={{ display: 'block', marginBottom: '5px', color: '#374151', fontWeight: '500' }}>
                City *
              </label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  background: '#fafafa',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer'
                }}
              >
                <option value="">Select City</option>
                <option value="Mumbai">Mumbai</option>
                <option value="Delhi">Delhi</option>
                <option value="Bangalore">Bangalore</option>
                <option value="Chennai">Chennai</option>
                <option value="Kolkata">Kolkata</option>
                <option value="Hyderabad">Hyderabad</option>
                <option value="Pune">Pune</option>
                <option value="Jaipur">Jaipur</option>
                <option value="Lucknow">Lucknow</option>
                <option value="Patna">Patna</option>
                <option value="Kochi">Kochi</option>
                <option value="Ahmedabad">Ahmedabad</option>
                <option value="Surat">Surat</option>
              </select>
            </div>
          )}

          {!isLogin && role === 'volunteer' && (
            <div>
              <label style={{ display: 'block', marginBottom: '5px', color: '#374151', fontWeight: '500' }}>
                Skills * (at least one required)
              </label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '8px',
                marginBottom: '15px'
              }}>
                {SKILLS.map(skill => (
                  <label key={skill} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    fontSize: '13px',
                    color: '#374151',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={selectedSkills.includes(skill)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedSkills([...selectedSkills, skill]);
                        } else {
                          setSelectedSkills(selectedSkills.filter(s => s !== skill));
                        }
                      }}
                      style={{
                        marginRight: '6px',
                        cursor: 'pointer'
                      }}
                    />
                    {skill}
                  </label>
                ))}
              </div>
            </div>
          )}

          {!isLogin && (
            <div>
              <label style={{ display: 'block', marginBottom: '5px', color: '#374151', fontWeight: '500' }}>
                I want to join as
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'staff' | 'volunteer')}
                required={!isLogin}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  background: '#fafafa',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer'
                }}
              >
                <option value="volunteer">Volunteer</option>
                <option value="staff">Staff Member</option>
              </select>
            </div>
          )}

          <div>
            <label style={{ display: 'block', marginBottom: '5px', color: '#374151', fontWeight: '500' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                boxSizing: 'border-box',
                background: '#fafafa',
                transition: 'all 0.2s ease'
              }}
              placeholder="Enter your password"
            />
          </div>

          {!isLogin && (
            <div>
              <label style={{ display: 'block', marginBottom: '5px', color: '#374151', fontWeight: '500' }}>
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required={!isLogin}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  background: '#fafafa',
                  transition: 'all 0.2s ease'
                }}
                placeholder="Confirm your password"
              />
            </div>
          )}

          {error && (
            <div style={{
              background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
              border: '1px solid #f87171',
              color: '#991b1b',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)' : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
              color: 'white',
              padding: '14px 24px',
              border: 'none',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: loading ? 'none' : '0 4px 12px rgba(34, 197, 94, 0.3)',
              transform: loading ? 'scale(0.98)' : 'scale(1)'
            }}
          >
            {loading ? (isLogin ? 'Signing in...' : 'Creating account...') : (isLogin ? 'Sign in' : 'Create account')}
          </button>
        </form>
      </div>
    </div>
  );
}
