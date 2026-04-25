import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { hasAccount, createUser, login, isLoggedIn } from '@/utils/auth';

const ACCENT = '#4169e1';
const BG = '#0f0f0f';
const CARD = '#1c1c1e';
const ROW_BG = '#2c2c2e';
const TEXT = '#ffffff';
const SECONDARY = '#8e8e93';
const RED = '#ff453a';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isLoggedIn()) {
      router.replace('/(tabs)');
      return;
    }
    setCreating(!hasAccount());
  }, []);

  function submit() {
    setError('');
    if (creating) {
      if (!username.trim() || !password.trim()) {
        setError('Username and password are required.');
        return;
      }
      if (password !== confirm) {
        setError('Passwords do not match.');
        return;
      }
      if (password.length < 4) {
        setError('Password must be at least 4 characters.');
        return;
      }
      createUser(username.trim(), password);
      login(username.trim(), password);
      router.replace('/(tabs)');
    } else {
      const ok = login(username.trim(), password);
      if (ok) {
        router.replace('/(tabs)');
      } else {
        setError('Incorrect username or password.');
      }
    }
  }

  return (
    <View style={s.container}>
      <View style={s.card}>
        <Text style={s.emoji}>🏋️</Text>
        <Text style={s.title}>Gym Tracker</Text>
        <Text style={s.subtitle}>
          {creating ? 'Create your account to get started' : 'Sign in to continue'}
        </Text>

        <TextInput
          style={s.input}
          value={username}
          onChangeText={setUsername}
          placeholder="Username"
          placeholderTextColor={SECONDARY}
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={submit}
        />
        <TextInput
          style={s.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={SECONDARY}
          secureTextEntry
          onSubmitEditing={creating ? undefined : submit}
        />
        {creating && (
          <TextInput
            style={s.input}
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Confirm Password"
            placeholderTextColor={SECONDARY}
            secureTextEntry
            onSubmitEditing={submit}
          />
        )}

        {error ? <Text style={s.error}>{error}</Text> : null}

        <TouchableOpacity style={s.btn} onPress={submit}>
          <Text style={s.btnText}>{creating ? 'Create Account' : 'Sign In'}</Text>
        </TouchableOpacity>

        {!creating && (
          <TouchableOpacity onPress={() => { setCreating(true); setError(''); }}>
            <Text style={s.switchText}>No account? Create one</Text>
          </TouchableOpacity>
        )}
        {creating && hasAccount() && (
          <TouchableOpacity onPress={() => { setCreating(false); setError(''); }}>
            <Text style={s.switchText}>Already have an account? Sign in</Text>
          </TouchableOpacity>
        )}
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
  subtitle: { fontSize: 14, color: SECONDARY, marginBottom: 28, textAlign: 'center' },
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
  },
  btnText: { color: TEXT, fontWeight: 'bold', fontSize: 16 },
  switchText: { color: SECONDARY, fontSize: 13 },
});
