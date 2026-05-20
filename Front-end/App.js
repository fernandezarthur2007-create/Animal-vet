import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
// Paste your new Railway URL here (e.g., 'https://animal-vet-backend-production.up.railway.app')
const BACKEND_URL = 'https://animal-vet-production.up.railway.app';

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const cameraRef = useRef(null);

  if (!permission) {
    return <View style={styles.container}><Text>Loading permissions...</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center', marginBottom: 20 }}>We need your permission to show the camera</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const options = { quality: 0.7, base64: true };
        const data = await cameraRef.current.takePictureAsync(options);
        setPhoto(data.uri);
        sendImageToBackend(data.base64);
      } catch (err) {
        setAnalysis(`Camera Capture Error: ${err.message}`);
      }
    }
  };

  const sendImageToBackend = async (base64Image) => {
    setLoading(true);
    setAnalysis(null);

    try {
      const response = await fetch(`${BACKEND_URL}/analyze-pet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: base64Image }),
      });

      const result = await response.json();
      if (response.ok) {
        setAnalysis(result.analysis);
      } else {
        setAnalysis(`Server Error: ${result.detail || 'Failed to analyze'}`);
      }
    } catch (error) {
      setAnalysis(`Network Connection Error.\n\nMake sure your phone and laptop are on the EXACT same Wi-Fi network name.\n\nDetails: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetCamera = () => {
    setPhoto(null);
    setAnalysis(null);
  };

  return (
    <View style={styles.container}>
      {!photo ? (
        <CameraView style={styles.camera} ref={cameraRef} facing="back">
          <View style={styles.cameraButtonContainer}>
            <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
              <View style={styles.innerCaptureButton} />
            </TouchableOpacity>
          </View>
        </CameraView>
      ) : (
        <View style={styles.previewContainer}>
          <Image source={{ uri: photo }} style={styles.previewImage} />

          <ScrollView style={styles.analysisContainer}>
            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Sending photo to Vet AI engine...</Text>
              </View>
            )}
            {analysis && <Text style={styles.analysisText}>{analysis}</Text>}
          </ScrollView>

          {!loading && (
            <TouchableOpacity style={styles.resetButton} onPress={resetCamera}>
              <Text style={styles.buttonText}>Take Another Picture</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', justifyContent: 'center' },
  camera: { flex: 1, justifyContent: 'flex-end' },
  cameraButtonContainer: { backgroundColor: 'transparent', alignSelf: 'center', marginBottom: 40 },
  captureButton: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  innerCaptureButton: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
  previewContainer: { flex: 1, backgroundColor: '#f5f5f5', paddingTop: 40 },
  previewImage: { width: '100%', height: 260, resizeMode: 'cover' },
  analysisContainer: { flex: 1, padding: 20 },
  analysisText: { fontSize: 16, lineHeight: 24, color: '#333' },
  loadingContainer: { alignItems: 'center', marginTop: 40 },
  loadingText: { marginTop: 10, fontSize: 16, color: '#666', fontWeight: '500' },
  button: { backgroundColor: '#007AFF', padding: 15, borderRadius: 8, alignSelf: 'center' },
  resetButton: { backgroundColor: '#007AFF', padding: 15, margin: 20, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});