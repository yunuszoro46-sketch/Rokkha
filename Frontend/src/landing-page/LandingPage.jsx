import React, { useState } from 'react';
import { 
  Shield, 
  ArrowRight, 
  User, 
  Mail, 
  MapPin, 
  ShieldCheck, 
  ChevronDown, 
  Zap, 
  Radio, 
  Headphones,
  CheckCircle2,
  SlidersHorizontal
} from 'lucide-react';
import './landing.css';

export default function LandingPage({ onOpenConsole }) {
  const [formData, setFormData] = useState({
    fullName: '',
    contact: '',
    location: '',
    requirement: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 700);
  };

  return (
    <div className="rokkha-landing">
      <div className="rokkha-hero-bg" />

      {/* Top Navbar Header */}
      <header className="rokkha-header">
        <div className="rokkha-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div className="rokkha-logo-shield">
            <Shield size={30} fill="currentColor" fillOpacity={0.2} />
          </div>
          <span className="rokkha-brand-title">
            Rokkha
          </span>
        </div>

        <div className="rokkha-nav-actions">
          <button type="button" onClick={onOpenConsole} className="rokkha-btn-protected">
            Get Protected <ArrowRight size={14} />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="rokkha-hero">
        {/* Left Column */}
        <div className="rokkha-hero-left">
          <div className="rokkha-hero-badge">
            <span className="rokkha-badge-dot" />
            <span>Next-Gen Protection Platform</span>
          </div>

          <h1 className="rokkha-hero-heading">
            A Safeguard <span className="rokkha-hero-heading-blue">when needed</span>
          </h1>

          <p className="rokkha-hero-subtext">
            Rokkha connects you to instant security response, real-time monitoring, and
            complete protection tailored for your home and personal safety. Simple,
            modern, and reliable.
          </p>

          <div className="rokkha-hero-divider" />

          <div className="rokkha-hero-stats">
            <div>
              <div className="rokkha-stat-value">99.9%</div>
              <div className="rokkha-stat-label">Reliability Rate</div>
            </div>
            <div>
              <div className="rokkha-stat-value">24 / 7</div>
              <div className="rokkha-stat-label">Active Monitoring</div>
            </div>
          </div>
        </div>

        {/* Right Column: Card Form */}
        <div className="rokkha-card-wrapper" id="early-access">
          <div className="rokkha-form-card">
            <h2 className="rokkha-form-title">Your Info</h2>
            <p className="rokkha-form-subtitle">Fill in your details below to get started with Rokkha.</p>

            {submitted ? (
              <div style={{ textAlign: 'center', padding: '36px 12px' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  color: '#34d399',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px'
                }}>
                  <CheckCircle2 size={30} />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
                  Request Received!
                </h3>
                <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.6, marginBottom: '20px' }}>
                  Thank you, <strong style={{ color: '#fff' }}>{formData.fullName || 'Valued User'}</strong>. A Rokkha protection advisor will reach out to you shortly.
                </p>
                <button
                  type="button"
                  className="rokkha-btn-submit"
                  onClick={onOpenConsole}
                >
                  Open Feature Modules Catalog <ArrowRight size={16} />
                </button>
                <button
                  type="button"
                  className="rokkha-btn-protected"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => {
                    setSubmitted(false);
                    setFormData({ fullName: '', contact: '', location: '', requirement: '' });
                  }}
                >
                  Submit Another Request
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {/* Full Name */}
                <div className="rokkha-form-group">
                  <label className="rokkha-input-label">Full Name</label>
                  <div className="rokkha-input-box">
                    <span className="rokkha-input-icon">
                      <User size={16} />
                    </span>
                    <input
                      type="text"
                      className="rokkha-input-field"
                      placeholder="e.g. Tanvir Ahmed"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* Email or Phone */}
                <div className="rokkha-form-group">
                  <label className="rokkha-input-label">Email or Phone Number</label>
                  <div className="rokkha-input-box">
                    <span className="rokkha-input-icon">
                      <Mail size={16} />
                    </span>
                    <input
                      type="text"
                      className="rokkha-input-field"
                      placeholder="name@domain.com or 017XXXXXXXX"
                      value={formData.contact}
                      onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* Location / City */}
                <div className="rokkha-form-group">
                  <label className="rokkha-input-label">Location / City</label>
                  <div className="rokkha-input-box">
                    <span className="rokkha-input-icon">
                      <MapPin size={16} />
                    </span>
                    <input
                      type="text"
                      className="rokkha-input-field"
                      placeholder="e.g. Dhaka, Chittagong"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* Protection Requirement */}
                <div className="rokkha-form-group">
                  <label className="rokkha-input-label">Protection Requirement</label>
                  <div className="rokkha-input-box">
                    <span className="rokkha-input-icon">
                      <ShieldCheck size={16} />
                    </span>
                    <select
                      className="rokkha-input-field"
                      value={formData.requirement}
                      onChange={(e) => setFormData({ ...formData, requirement: e.target.value })}
                    >
                      <option value="">Select standard service</option>
                      <option value="flood">Flood & Climate Hazard Shield</option>
                      <option value="residential">Residential & Home Safety</option>
                      <option value="enterprise">Commercial & Infrastructure Monitoring</option>
                      <option value="rapid-response">Rapid Emergency Response Dispatch</option>
                    </select>
                    <span className="rokkha-select-arrow">
                      <ChevronDown size={15} />
                    </span>
                  </div>
                </div>

                <button type="submit" className="rokkha-btn-submit" disabled={loading}>
                  {loading ? 'Processing...' : (
                    <>
                      Get Started <ArrowRight size={16} />
                    </>
                  )}
                </button>

                <div className="rokkha-form-security">
                  Your Information is encrypted & secure with Rokkha protocols.
                </div>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Why Choose Rokkha Section */}
      <section className="rokkha-features-section">
        <div className="rokkha-section-header">
          <h2 className="rokkha-section-title">Why Choose Rokkha</h2>
          <p className="rokkha-section-subtitle">
            Built with modern tech and relentless reliability for seamless protection.
          </p>
        </div>

        <div className="rokkha-features-grid">
          {/* Card 1 */}
          <div className="rokkha-feature-card">
            <div className="rokkha-feature-icon-box">
              <Zap size={20} />
            </div>
            <h3 className="rokkha-feature-title">Instant Response</h3>
            <p className="rokkha-feature-desc">
              Rapid alert dispatch systems connect your requests directly to emergency resources with
              zero delays.
            </p>
          </div>

          {/* Card 2 */}
          <div className="rokkha-feature-card">
            <div className="rokkha-feature-icon-box">
              <Radio size={20} />
            </div>
            <h3 className="rokkha-feature-title">Real-Time Updates</h3>
            <p className="rokkha-feature-desc">
              Live status monitoring keeps you informed of your safety status with complete transparent
              tracking.
            </p>
          </div>

          {/* Card 3 */}
          <div className="rokkha-feature-card">
            <div className="rokkha-feature-icon-box">
              <Headphones size={20} />
            </div>
            <h3 className="rokkha-feature-title">24/7 Dedicated Support</h3>
            <p className="rokkha-feature-desc">
              Our specialized security teams are active around the clock, ensuring you're never without
              assistance.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="rokkha-footer">
        <div className="rokkha-footer-inner">
          <div className="rokkha-footer-left">
            <span className="rokkha-footer-brand">Rokkha</span>
            <span>|</span>
            <span>© 2026 Rokkha Security Solutions. All rights reserved.</span>
          </div>

          <div className="rokkha-footer-links">
            <a href="#privacy" className="rokkha-footer-link">Privacy Policy</a>
            <a href="#terms" className="rokkha-footer-link">Terms of Service</a>
            <a href="#support" className="rokkha-footer-link">Contact Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

