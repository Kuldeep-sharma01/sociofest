import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Camera, ShieldCheck, Trash2, UserCheck, AlertCircle, Fingerprint, ShieldAlert } from 'lucide-react';
import CameraCapture from '@/components/CameraCapture';
import { registerFace } from '@/services/aiService';
import { updateUser } from '@/redux/authSlice';
import { useTheme } from "@/context/ThemeContext";
import { getCardThemeClasses, getPrimaryButtonClasses } from "@/utils/themeUtils";
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { apiClient } from '@/services/apiClient';

const BiometricSettings = ({ user }) => {
  const { appTheme } = useTheme();
  const dispatch = useDispatch();
  const currentUser = useSelector((state) => state.auth.user);
  const [showCapture, setShowCapture] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isSelf = currentUser?._id === user?._id;

  const handleFaceRegistration = async (imageBlob) => {
    try {
      setLoading(true);
      setError('');
      
      const response = await registerFace(imageBlob, user._id);
      
      if (response.success) {
        setSuccess('Face registered successfully! ✅');
        setShowCapture(false);
        
        if (isSelf) {
          // Update user in Redux with a truthy value to indicate registration
          dispatch(updateUser({ ...currentUser, faceEncodingVector: 'registered' }));
        }
      } else {
        setError(response.error || 'Registration failed. Please try again.');
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to register face.';
      if (msg.toLowerCase().includes('network error') || msg.includes('502')) {
        setError('Network error: AI service is unavailable. Please ensure the Python backend is running on port 5001.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFace = async () => {
    if (!window.confirm("Are you sure you want to delete your face registration? You won't be able to use face attendance until you re-register.")) return;
    
    try {
      setLoading(true);
      // We don't have a direct "delete" service yet, but we can clear it via the users collection
      // For now, let's assume there's a backend route for this. 
      // If not, we'll need to add it to the Node backend.
      await apiClient.post(`/users/${user._id}/clear-face`);
      
      if (isSelf) {
        dispatch(updateUser({ ...currentUser, faceEncodingVector: null }));
      }
      setSuccess('Face data cleared. 🗑️');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete face data.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`p-6 rounded-2xl shadow-lg border transition-all duration-300 ${getCardThemeClasses(appTheme)}`}>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-blue-500/10 rounded-xl">
          <Fingerprint className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-inherit">Biometric Security</h3>
          <p className="text-sm opacity-70 text-inherit">Manage your facial recognition data for secure attendance.</p>
        </div>
      </div>

      {success && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-3 text-green-600 dark:text-green-400 animate-in fade-in slide-in-from-top-2">
          <ShieldCheck className="w-5 h-5" />
          <span className="text-sm font-medium">{success}</span>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400 animate-in fade-in slide-in-from-top-2">
          <ShieldAlert className="w-5 h-5" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {!showCapture ? (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-5 bg-black/5 dark:bg-white/5 rounded-2xl border border-inherit/20 gap-4">
            <div className="flex items-center gap-4">
              <div className={`p-4 rounded-full ${user.faceEncodingVector ? 'bg-green-500/20 text-green-600' : 'bg-gray-500/10 text-gray-400'}`}>
                {user.faceEncodingVector ? <UserCheck className="w-8 h-8" /> : <Camera className="w-8 h-8" />}
              </div>
              <div>
                <p className="font-bold text-inherit">Face Registration</p>
                <p className="text-sm opacity-70 text-inherit">
                  {user.faceEncodingVector 
                    ? 'Your face is registered and active.' 
                    : 'Not registered yet. Required for AI attendance.'}
                </p>
              </div>
            </div>
            
            <div className="flex gap-2 w-full md:w-auto">
              {user.faceEncodingVector ? (
                <>
                  <Button 
                    variant="outline" 
                    className="flex-1 md:flex-none"
                    onClick={() => setShowCapture(true)}
                  >
                    Update
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                    onClick={handleDeleteFace}
                    disabled={loading}
                  >
                    {loading ? <Spinner className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                  </Button>
                </>
              ) : (
                <Button 
                  className={`flex-1 md:flex-none font-bold ${getPrimaryButtonClasses(appTheme)}`}
                  onClick={() => setShowCapture(true)}
                >
                  Register Now
                </Button>
              )}
            </div>
          </div>

          <div className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
            <div className="text-xs text-yellow-700 dark:text-yellow-300 opacity-90 leading-relaxed">
              <p className="font-bold mb-1">Privacy Notice</p>
              Your facial biometric data is converted into a non-reversible mathematical vector and encrypted before storage. We do not store your actual photo for recognition purposes.
            </div>
          </div>
        </div>
      ) : (
        <div className="animate-in fade-in zoom-in-95 duration-300">
          <CameraCapture 
            onCapture={handleFaceRegistration}
            onCancel={() => setShowCapture(false)}
            title="Face Enrollment"
            description="Look directly at the camera. Ensure good lighting and a clear background."
          />
        </div>
      )}
    </div>
  );
};

export default BiometricSettings;
