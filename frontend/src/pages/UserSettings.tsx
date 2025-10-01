import React, { useState, useEffect } from 'react';

interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  profile_image_url?: string;
  created_at: string;
}

interface UserSettings {
  preferences: Record<string, any>;
  theme: string;
  ai_instructions?: string;
  visualization_settings: Record<string, any>;
}

export function UserSettings() {
  const [activeSection, setActiveSection] = useState<'profile' | 'preferences' | 'visualization'>('profile');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [editedProfile, setEditedProfile] = useState({
    first_name: '',
    last_name: '',
    profile_image_url: ''
  });
  
  const [editedSettings, setEditedSettings] = useState({
    theme: 'dark',
    ai_instructions: '',
    force_strength: 0.5,
    show_labels: true
  });

  useEffect(() => {
    loadProfileAndSettings();
  }, []);

  const loadProfileAndSettings = async () => {
    try {
      const [profileRes, settingsRes] = await Promise.all([
        fetch('/api/v1/user/profile'),
        fetch('/api/v1/user/settings')
      ]);
      
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setProfile(profileData);
        setEditedProfile({
          first_name: profileData.first_name || '',
          last_name: profileData.last_name || '',
          profile_image_url: profileData.profile_image_url || ''
        });
      }
      
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setSettings(settingsData);
        setEditedSettings({
          theme: settingsData.theme || 'dark',
          ai_instructions: settingsData.ai_instructions || '',
          force_strength: settingsData.visualization_settings?.force_strength || 0.5,
          show_labels: settingsData.visualization_settings?.show_labels !== false
        });
      }
    } catch (error) {
      console.error('Failed to load profile/settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/v1/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedProfile)
      });
      
      if (response.ok) {
        await loadProfileAndSettings();
        alert('Profile updated successfully!');
      } else {
        alert('Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Error updating profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/v1/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme: editedSettings.theme,
          ai_instructions: editedSettings.ai_instructions,
          visualization_settings: {
            force_strength: editedSettings.force_strength,
            show_labels: editedSettings.show_labels
          }
        })
      });
      
      if (response.ok) {
        await loadProfileAndSettings();
        alert('Settings updated successfully!');
      } else {
        alert('Failed to update settings');
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      alert('Error updating settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-cyan-400 text-xl">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-magenta-400 bg-clip-text text-transparent mb-2">
            User Settings
          </h1>
          <p className="text-gray-400">Manage your profile and preferences</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-8">
          <div className="w-full sm:w-64 space-y-2">
            <button
              onClick={() => setActiveSection('profile')}
              className={`w-full px-4 py-3 rounded-lg text-left transition-all ${
                activeSection === 'profile'
                  ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-400/50 text-cyan-400'
                  : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="font-medium">Profile</span>
              </div>
            </button>

            <button
              onClick={() => setActiveSection('preferences')}
              className={`w-full px-4 py-3 rounded-lg text-left transition-all ${
                activeSection === 'preferences'
                  ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-400/50 text-cyan-400'
                  : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="font-medium">Preferences</span>
              </div>
            </button>

            <button
              onClick={() => setActiveSection('visualization')}
              className={`w-full px-4 py-3 rounded-lg text-left transition-all ${
                activeSection === 'visualization'
                  ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-400/50 text-cyan-400'
                  : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
                <span className="font-medium">Visualization</span>
              </div>
            </button>
          </div>

          <div className="flex-1">
            {activeSection === 'profile' && (
              <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                <h2 className="text-2xl font-bold text-cyan-400 mb-6">Profile Information</h2>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Email (read-only)</label>
                    <input
                      type="email"
                      value={profile?.email || ''}
                      disabled
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-gray-500 cursor-not-allowed"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">First Name</label>
                      <input
                        type="text"
                        value={editedProfile.first_name}
                        onChange={(e) => setEditedProfile({ ...editedProfile, first_name: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-cyan-400 focus:outline-none transition-colors"
                        placeholder="Enter first name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Last Name</label>
                      <input
                        type="text"
                        value={editedProfile.last_name}
                        onChange={(e) => setEditedProfile({ ...editedProfile, last_name: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-cyan-400 focus:outline-none transition-colors"
                        placeholder="Enter last name"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Profile Image URL</label>
                    <input
                      type="url"
                      value={editedProfile.profile_image_url}
                      onChange={(e) => setEditedProfile({ ...editedProfile, profile_image_url: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-cyan-400 focus:outline-none transition-colors"
                      placeholder="https://example.com/avatar.jpg"
                    />
                  </div>

                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </div>
            )}

            {activeSection === 'preferences' && (
              <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                <h2 className="text-2xl font-bold text-cyan-400 mb-6">General Preferences</h2>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Theme</label>
                    <select
                      value={editedSettings.theme}
                      onChange={(e) => setEditedSettings({ ...editedSettings, theme: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-cyan-400 focus:outline-none transition-colors"
                    >
                      <option value="dark" className="bg-gray-900">Dark (Ultra-Bright Neon)</option>
                      <option value="light" className="bg-gray-900">Light</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      AI Instructions
                      <span className="ml-2 text-xs text-gray-500">(Optional custom instructions for AI)</span>
                    </label>
                    <textarea
                      value={editedSettings.ai_instructions}
                      onChange={(e) => setEditedSettings({ ...editedSettings, ai_instructions: e.target.value })}
                      rows={6}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-cyan-400 focus:outline-none transition-colors resize-none"
                      placeholder="Enter any custom instructions or preferences for AI assistants..."
                    />
                  </div>

                  <button
                    onClick={handleSaveSettings}
                    disabled={saving}
                    className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving...' : 'Save Preferences'}
                  </button>
                </div>
              </div>
            )}

            {activeSection === 'visualization' && (
              <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                <h2 className="text-2xl font-bold text-cyan-400 mb-6">Visualization Settings</h2>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Force Strength: {editedSettings.force_strength.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={editedSettings.force_strength}
                      onChange={(e) => setEditedSettings({ ...editedSettings, force_strength: parseFloat(e.target.value) })}
                      className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                    <p className="mt-2 text-sm text-gray-400">
                      Controls the repulsion strength between nodes in the 3D visualization
                    </p>
                  </div>

                  <div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editedSettings.show_labels}
                        onChange={(e) => setEditedSettings({ ...editedSettings, show_labels: e.target.checked })}
                        className="w-5 h-5 bg-white/5 border border-white/10 rounded text-cyan-500 focus:ring-2 focus:ring-cyan-500"
                      />
                      <span className="text-gray-300">Show Node Labels</span>
                    </label>
                    <p className="mt-2 ml-8 text-sm text-gray-400">
                      Display names and information on nodes in the visualization
                    </p>
                  </div>

                  <button
                    onClick={handleSaveSettings}
                    disabled={saving}
                    className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving...' : 'Save Visualization Settings'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 p-4 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-400/30 rounded-lg">
          <h3 className="text-sm font-medium text-cyan-400 mb-2">Account Information</h3>
          <div className="text-sm text-gray-400 space-y-1">
            <p><span className="text-gray-500">User ID:</span> {profile?.id}</p>
            <p><span className="text-gray-500">Member since:</span> {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
