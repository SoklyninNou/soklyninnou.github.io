import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { createUser, login } from '@/utils/auth';

const ACCENT = '#4169e1';
const BG = '#0f0f0f';
const CARD = '#1c1c1e';
const ROW_BG = '#2c2c2e';
const TEXT = '#ffffff';
const SECONDARY = '#8e8e93';
const RED = '#ff453a';

export default function CreateAccountScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    setError('');
    if (!username.trim() || !password) { setError('All fields are required.'); return; }
    if (password.length < 4) { setError('Password must be at least 4 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }

    setLoading(true);
    await createUser(username.trim(), password);
    await login(username.trim(), password);
    setLoading(false);
    router.replace('/(tabs)');
  }

  return (
    <View style={s.container}>
      <View style={s.card}>
        <Text style={s.emoji}>🏋️</Text>
        <Text style={s.title}>Create Account</Text>
        <Text style={s.subtitle}>Your password is hashed before being saved.</Text>

        <TextInput
          style={s.input}
          value={username}
          onChangeText={setUsername}
          placeholder="Username"
          placeholderTextColor={SECONDARY}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={s.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={SECONDARY}
          secureTextEntry
        />
        <TextInput
          style={s.input}
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Confirm Password"
          placeholderTextColor={SECONDARY}
          secureTextEntry
          onSubmitEditing={handleCreate}
        />

        {error ? <Text style={s.error}>{error}</Text> : null}

        <TouchableOpacity style={s.btn} onPress={handleCreate} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>Create Account</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.backText}>Already have an account? Sign in</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 20,
    padding: 32,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  emoji: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: 'bold', color: TEXT, marginBottom: 4 },
  subtitle: { fontSize: 13, color: SECONDARY, marginBottom: 28, textAlign: 'center' },
  input: {
    backgroundColor: ROW_BG,
    color: TEXT,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    width: '100%',
    marginBottom: 12,
  },
  error: { color: RED, fontSize: 13, marginBottom: 12, textAlign: 'center' },
  btn: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    padding: 15,
    width: '100%',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 16,
    minHeight: 50,
    justifyContent: 'center',
  },
  btnText: { color: TEXT, fontWeight: 'bold', fontSize: 16 },
  backText: { color: SECONDARY, fontSize: 13 },
});
