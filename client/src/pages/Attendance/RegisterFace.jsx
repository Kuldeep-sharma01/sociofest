import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import CameraCapture from '@/components/CameraCapture';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { CheckCircle, AlertCircle, Camera } from 'lucide-react';
import { pythonAPI } from '@/lib/api';
import { useTheme } from '@/context/ThemeContext';
import { useAIPing } from '@/hooks/useAIPing';
import { getBannerThemeClasses, getCardThemeClasses, getPrimaryButtonClasses } from '@/utils/themeUtils';

export default function RegisterFacePage() {
  const user = useSelector((state) => state.auth.user);
  const isAuthenticated = !!user;
  const loading = false;
  const navigate = useNavigate();
  const [stage, setStage] = useState('capture');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const { appTheme } = useTheme();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login');
    }
  }, [loading, isAuthenticated, navigate]);

  const handleRetry = useCallback(() => {
    setStage('capture');
    setError('');
  }, []);

  useAIPing(stage, handleRetry, 'registerFace');

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const handleCapture = async (imageBlob) => {
    setStage('processing');
    setError('');

    try {
      const formData = new FormData();
      formData.append('image', imageBlob);
      formData.append('userId', user.id || user._id);
      formData.append('clientLivenessVerified', 'true'); // Assuming liveness is verified on client-side
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout for registration

      const data = await pythonAPI.registerFace(formData, controller.signal);
      clearTimeout(timeoutId);

      setSuccessMessage(`Face registered successfully! Encoding dimensions: ${data.encodingDimensions}`);
      setStage('success');
      window.dispatchEvent(new CustomEvent("showToast", { detail: "Face registered successfully! ✅" }));

      setTimeout(() => {
        navigate('/dashboard/profile');
      }, 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to register face';
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError') || errorMessage.includes('Load failed') || errorMessage.includes('aborted')) {
        setStage('offline');
      } else {
        setError(errorMessage);
        setStage('error');
        window.dispatchEvent(new CustomEvent("showToast", { detail: `${errorMessage} ❌` }));
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in duration-500">
        {/* Header Banner */}
        <div className={`${getBannerThemeClasses(appTheme, "bg-gradient-to-r from-purple-600 to-pink-600 text-white")} rounded-3xl p-8 shadow-lg relative overflow-hidden transition-colors`}>
          <div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-10">
            <Camera className="w-64 h-64" />
          </div>
          <div className="relative z-10">
            <h1 className="text-3xl md:text-4xl font-extrabold flex items-center gap-3">Register Face</h1>
            <p className="mt-2 opacity-90 max-w-xl text-lg font-medium">Set up your facial recognition profile for secure attendance marking.</p>
          </div>
        </div>

        <Card className={`${getCardThemeClasses(appTheme)} border-inherit/20`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-inherit">
              <Camera className="h-5 w-5" />
              Face Registration Setup
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Note:</strong> Your face will be securely encoded and stored for future attendance verification.
                The system will NOT store raw images, only mathematical face encodings for security.
              </p>
            </div>

            {stage === 'capture' && (
              <CameraCapture
                onCapture={handleCapture}
                onCancel={() => navigate('/dashboard/profile')}
                title="Capture Your Face"
                description="Make sure your face is clearly visible and centered in the frame. Good lighting is important."
              />
            )}

            {stage === 'processing' && (
              <div className="flex flex-col items-center justify-center py-12">
                <Spinner className="h-12 w-12 mb-4 text-blue-500" />
                <p className="text-lg font-semibold text-inherit mb-2">Processing...</p>
                <p className="text-sm text-inherit opacity-70">
                  Analyzing your face and creating a secure encoding...
                </p>
              </div>
            )}

            {stage === 'success' && (
              <div className="flex flex-col items-center justify-center py-12">
                <CheckCircle className="h-16 w-16 text-green-500 dark:text-green-400 mb-4" />
                <p className="text-lg font-semibold text-inherit mb-2">Face Registered Successfully!</p>
                <p className="text-sm text-inherit opacity-70 text-center mb-6 max-w-md">
                  {successMessage}
                </p>
                <p className="text-xs text-inherit opacity-60">
                  Redirecting to profile in 3 seconds...
                </p>
                <Button
                  onClick={() => navigate('/dashboard/profile')}
                  className={`mt-4 ${getPrimaryButtonClasses(appTheme)}`}
                >
                  Go to Profile Now
                </Button>
              </div>
            )}

            {stage === 'error' && (
              <div className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-16 w-16 text-red-500 dark:text-red-400 mb-4" />
                <p className="text-lg font-semibold text-inherit mb-2">Registration Failed</p>
                <p className="text-sm text-red-500 dark:text-red-400 text-center mb-6 max-w-md font-medium">{error}</p>
                <div className="flex gap-3">
                  <Button onClick={handleRetry} className={getPrimaryButtonClasses(appTheme)}>
                    <Camera className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/dashboard/profile')}>
                    Go Back
                  </Button>
                </div>
              </div>
            )}

        {stage === 'offline' && (
          <div className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-16 w-16 text-orange-500 dark:text-orange-400 mb-4" />
                <p className="text-lg font-semibold text-inherit mb-2">AI Service Offline</p>
                <p className="text-sm text-orange-600 dark:text-orange-400 text-center mb-6 max-w-md font-medium">
              The facial registration service is currently down. We cannot process your face encoding at this moment. Please try again later.
            </p>
            <div className="flex gap-3">
                  <Button onClick={handleRetry} className={getPrimaryButtonClasses(appTheme)}>
                <Camera className="h-4 w-4 mr-2" />
                Retry Connection
              </Button>
              <Button variant="outline" onClick={() => navigate('/dashboard/profile')}>
                Go Back
              </Button>
            </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-inherit opacity-70">
            <Spinner className="w-3 h-3" /> Auto-retrying every 5 seconds...
          </div>
          </div>
        )}
          </CardContent>
        </Card>

        {/* Tips Section */}
        <Card className={`${getCardThemeClasses(appTheme)} border-inherit/20`}>
          <CardHeader>
            <CardTitle className="text-base text-inherit">Tips for Best Results</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-inherit opacity-90">
              <li className="flex gap-2">
                <span className="text-green-500 dark:text-green-400 font-bold">✓</span>
                <span>Look directly at the camera with a neutral expression</span>
              </li>
              <li className="flex gap-2">
                <span className="text-green-500 dark:text-green-400 font-bold">✓</span>
                <span>Ensure good lighting - avoid backlighting or shadows</span>
              </li>
              <li className="flex gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>Position your face within the outlined box</span>
              </li>
              <li className="flex gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>Keep your face a normal distance from the camera</span>
              </li>
              <li className="flex gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>Remove sunglasses, hats, or other face coverings</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
  );
}
