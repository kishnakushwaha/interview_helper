import React, { useState, useEffect, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    StatusBar,
    PermissionsAndroid,
    Platform,
    Animated,
    Dimensions,
} from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import axios from 'axios';
import RNFS from 'react-native-fs';

const { width } = Dimensions.get('window');

// 🎨 DESIGN TOKENS
const COLORS = {
    bg: ['#0f172a', '#1e1b4b', '#312e81'], // Deep Indigo Gradient
    glass: 'rgba(255, 255, 255, 0.08)',
    glassBorder: 'rgba(255, 255, 255, 0.15)',
    primary: '#38bdf8', // Sky Blue
    secondary: '#818cf8', // Indigo
    accent: '#f472b6', // Pink
    text: '#f8fafc',
    subText: '#94a3b8',
    danger: '#ef4444',
};

const BACKEND_URL = 'http://192.168.1.33:8000/audio/listen-and-answer';
const USER_TOKEN = 'mock-premium-token';

const GlassCard = ({ children, style, highlight = false }) => (
    <View style={[
        styles.glassCard,
        style,
        highlight && { borderColor: COLORS.primary, borderWidth: 1 }
    ]}>
        {children}
    </View>
);

const App = () => {
    const [isListening, setIsListening] = useState(false);
    const [isPro, setIsPro] = useState(false); // 💰 MOCKED PRO STATUS
    const [showPaywall, setShowPaywall] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [answer, setAnswer] = useState('');
    const [keyPoints, setKeyPoints] = useState([]);
    const [history, setHistory] = useState([]);

    const audioRecorderPlayer = useRef(new AudioRecorderPlayer()).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // ⚠️ V2 ISOLATION TEST: Native audio modules are temporarily removed to fix launch crash.
    // We are mocking the 'listening' state purely in JS to prove the UI doesn't crash the app.

    useEffect(() => {
        if (isListening) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [isListening]);

    useEffect(() => {
        if (answer) {
            Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
        } else {
            fadeAnim.setValue(0);
        }
    }, [answer]);

    const requestPermissions = async () => {
        if (Platform.OS === 'android') {
            try {
                const grants = await PermissionsAndroid.requestMultiple([
                    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                ]);
                return grants['android.permission.RECORD_AUDIO'] === PermissionsAndroid.RESULTS.GRANTED;
            } catch (err) {
                console.warn(err);
                return false;
            }
        }
        return true;
    };

    const startListening = async () => {
        if (!isPro) {
            setShowPaywall(true);
            return;
        }

        const hasPermission = await requestPermissions();
        if (!hasPermission) {
            setTranscript('Microphone permission denied.');
            return;
        }

        setIsListening(true);
        setTranscript('Listening... Speak your interview answer.');
        setAnswer('');
        setKeyPoints([]);

        try {
            await audioRecorderPlayer.startRecorder();
            audioRecorderPlayer.addRecordBackListener((e) => {
                // Keep recording active
            });
        } catch (error) {
            console.warn('Failed to start recording', error);
            setIsListening(false);
            setTranscript('Failed to access microphone.');
        }
    };

    const stopListening = async () => {
        setIsListening(false);
        try {
            const uri = await audioRecorderPlayer.stopRecorder();
            audioRecorderPlayer.removeRecordBackListener();
            setTranscript('Processing your answer... (Sending to AI)');

            // Fix URI formatting (prevent file://file:// error)
            let fileUri = uri;
            if (Platform.OS === 'android' && !fileUri.startsWith('file://')) {
                fileUri = 'file://' + fileUri;
            }

            // Send to backend
            const formData = new FormData();
            formData.append('file', {
                uri: fileUri,
                type: 'audio/mp4',
                name: 'recording.mp4',
            });

            // Use native fetch instead of Axios to avoid Android Mime/FormData bugs
            const response = await fetch(BACKEND_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${USER_TOKEN}`
                },
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data) {
                setTranscript(data.transcript || 'Audio processed.');
                setAnswer(data.answer || 'No answer generated.');
                if (data.key_points) {
                    setKeyPoints(data.key_points);
                }
            }
        } catch (error) {
            console.error('Error in audio processing: ', error);
            setTranscript(`Error: ${error.message || 'Server Unreachable'}`);
        }
    };

    const UpgradeOverlay = () => (
        <View style={styles.paywallOverlay}>
            <GlassCard style={styles.paywallCard}>
                <Text style={styles.paywallEmoji}>🚀</Text>
                <Text style={styles.paywallTitle}>Get DesierAI Pro</Text>
                <Text style={styles.paywallDesc}>Unlimited real-time answers, smart key points, and zero lag.</Text>

                <TouchableOpacity style={styles.proOption} onPress={() => { setIsPro(true); setShowPaywall(false); }}>
                    <View>
                        <Text style={styles.optionTitle}>Monthly Access</Text>
                        <Text style={styles.optionPrice}>$9.99 / mo</Text>
                    </View>
                    <View style={styles.bestValue}><Text style={styles.bestText}>POPULAR</Text></View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.proOption} onPress={() => { setIsPro(true); setShowPaywall(false); }}>
                    <View>
                        <Text style={styles.optionTitle}>Lifetime Mastery</Text>
                        <Text style={styles.optionPrice}>$49.99 once</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.closeButton} onPress={() => setShowPaywall(false)}>
                    <Text style={styles.closeText}>Maybe Later</Text>
                </TouchableOpacity>
            </GlassCard>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* MAIN INDIGO BACKGROUND */}
            <View style={styles.bgFilter} />

            <View style={styles.header}>
                <Text style={styles.brandTitle}>DESIER<Text style={{ color: COLORS.primary }}>AI</Text></Text>
                <View style={styles.headerRight}>
                    {!isPro && (
                        <TouchableOpacity style={styles.upgradeBadge} onPress={() => setShowPaywall(true)}>
                            <Text style={styles.upgradeText}>UPGRADE</Text>
                        </TouchableOpacity>
                    )}
                    <View style={styles.statusBadge}>
                        <View style={[styles.statusDot, { backgroundColor: isListening ? '#22c55e' : '#64748b' }]} />
                        <Text style={styles.statusText}>{isListening ? 'LIVE' : isPro ? 'PRO' : 'FREE'}</Text>
                    </View>
                </View>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <GlassCard style={{ marginTop: 10 }}>
                    <Text style={styles.label}>LAST HEARD</Text>
                    <Text style={styles.transcriptText}>{transcript || 'Speak or start the interview...'}</Text>
                </GlassCard>

                {answer ? (
                    <Animated.View style={{ opacity: fadeAnim }}>
                        <GlassCard highlight style={{ marginTop: 20 }}>
                            <View style={styles.answerHeader}>
                                <Text style={styles.labelHighlight}>AI INSIGHT</Text>
                                {isPro && <View style={styles.proBadge}><Text style={styles.proText}>PRO</Text></View>}
                            </View>
                            <Text style={styles.answerText}>{answer}</Text>

                            {keyPoints.length > 0 && (
                                <View style={styles.keyPointsContainer}>
                                    {keyPoints.map((point, i) => (
                                        <View key={i} style={styles.pointRow}>
                                            <View style={styles.activePoint} />
                                            <Text style={styles.pointText}>{point}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </GlassCard>
                    </Animated.View>
                ) : (
                    <View style={styles.emptyState}>
                        {!isPro && <Text style={styles.freeLimitText}>Free tier: 0 test sessions remaining</Text>}
                        <Text style={styles.emptyText}>Tap start to begin transcription</Text>
                    </View>
                )}
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.mainButtonContainer}
                    onPress={isListening ? stopListening : startListening}>
                    <Animated.View style={[
                        styles.button,
                        isListening ? styles.buttonStop : styles.buttonStart,
                        { transform: [{ scale: pulseAnim }] }
                    ]}>
                        <Text style={styles.buttonText}>
                            {isListening ? 'STOP' : 'START INTERVIEW'}
                        </Text>
                    </Animated.View>
                </TouchableOpacity>
            </View>

            {showPaywall && <UpgradeOverlay />}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    bgFilter: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: '#1e1b4b', // Deep night indigo
        opacity: 0.9,
    },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 25, paddingTop: 20, paddingBottom: 10
    },
    headerRight: { flexDirection: 'row', alignItems: 'center' },
    upgradeBadge: {
        backgroundColor: 'rgba(244, 114, 182, 0.2)', paddingHorizontal: 10, paddingVertical: 5,
        borderRadius: 8, marginRight: 10, borderWidth: 1, borderColor: COLORS.accent
    },
    upgradeText: { color: COLORS.accent, fontSize: 10, fontWeight: '900' },
    brandTitle: { fontSize: 22, fontWeight: '900', color: COLORS.text, letterSpacing: 2 },
    statusBadge: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)',
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: COLORS.glassBorder
    },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
    statusText: { color: COLORS.text, fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },
    content: { flex: 1, paddingHorizontal: 25 },
    glassCard: {
        backgroundColor: COLORS.glass,
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    label: { fontSize: 10, fontWeight: 'bold', color: COLORS.subText, letterSpacing: 1.5, marginBottom: 10 },
    labelHighlight: { fontSize: 10, fontWeight: 'bold', color: COLORS.primary, letterSpacing: 1.5 },
    transcriptText: { fontSize: 16, color: COLORS.text, lineHeight: 24, fontStyle: 'italic', opacity: 0.8 },
    answerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    proBadge: { backgroundColor: COLORS.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    proText: { color: '#0f172a', fontSize: 9, fontWeight: '900' },
    answerText: { fontSize: 17, color: COLORS.text, lineHeight: 28, fontWeight: '500' },
    keyPointsContainer: { marginTop: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: COLORS.glassBorder },
    pointRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    activePoint: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary, marginRight: 12 },
    pointText: { color: COLORS.subText, fontSize: 14, flex: 1 },
    emptyState: { height: 200, justifyContent: 'center', alignItems: 'center' },
    emptyText: { color: COLORS.text, fontSize: 14, opacity: 0.3 },
    freeLimitText: { color: COLORS.accent, fontSize: 12, marginBottom: 10, fontWeight: 'bold' },
    footer: { paddingBottom: 40, alignItems: 'center' },
    mainButtonContainer: { width: 220, height: 70, justifyContent: 'center', alignItems: 'center' },
    button: {
        width: '100%', height: '100%', borderRadius: 35, justifyContent: 'center', alignItems: 'center',
        shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 15,
    },
    buttonStart: { backgroundColor: COLORS.primary },
    buttonStop: { backgroundColor: COLORS.danger },
    buttonText: { color: '#0f172a', fontWeight: '900', fontSize: 15, letterSpacing: 1 },

    // 💸 PAYWALL STYLES
    paywallOverlay: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.95)', justifyContent: 'center', padding: 25
    },
    paywallCard: { alignItems: 'center', paddingVertical: 40 },
    paywallEmoji: { fontSize: 50, marginBottom: 20 },
    paywallTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.text, marginBottom: 10 },
    paywallDesc: { fontSize: 14, color: COLORS.subText, textAlign: 'center', marginBottom: 30, lineHeight: 20 },
    proOption: {
        width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', padding: 20, borderRadius: 16,
        marginBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        borderWidth: 1, borderColor: COLORS.glassBorder
    },
    optionTitle: { color: COLORS.text, fontSize: 16, fontWeight: 'bold' },
    optionPrice: { color: COLORS.primary, fontSize: 14, marginTop: 4 },
    bestValue: { backgroundColor: COLORS.accent, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    bestText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    closeButton: { marginTop: 20 },
    closeText: { color: COLORS.subText, fontSize: 14 },
});

export default App;
