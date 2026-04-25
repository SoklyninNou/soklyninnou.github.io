import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import { getWorkouts, deleteWorkout } from '@/utils/storage';
import { SavedWorkout } from '@/types/workout';

const ACCENT = '#4169e1';
const BG = '#0f0f0f';
const CARD = '#1c1c1e';
const ROW_BG = '#2c2c2e';
const TEXT = '#ffffff';
const SECONDARY = '#8e8e93';
const RED = '#ff453a';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
  });
}

function totalVolume(workout: SavedWorkout): number {
  return workout.exercises.reduce(
    (sum, e) => sum + e.sets.reduce((s, set) => s + set.reps * set.weight, 0),
    0
  );
}

function totalSets(workout: SavedWorkout): number {
  return workout.exercises.reduce((n, e) => n + e.sets.length, 0);
}

function WorkoutCard({
  workout,
  onDelete,
}: {
  workout: SavedWorkout;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const volume = totalVolume(workout);

  return (
    <View style={s.card}>
      <TouchableOpacity onPress={() => setExpanded((v) => !v)} activeOpacity={0.8}>
        <View style={s.cardTop}>
          <View>
            <Text style={s.cardDate}>{formatDate(workout.date)}</Text>
            <Text style={s.cardTime}>{formatTime(workout.date)}</Text>
          </View>
          <View style={s.cardTopRight}>
            {workout.durationMinutes > 0 && (
              <Text style={s.duration}>⏱ {workout.durationMinutes}m</Text>
            )}
            <Text style={s.chevron}>{expanded ? '▲' : '▼'}</Text>
          </View>
        </View>

        <View style={s.statsRow}>
          <View style={s.stat}>
            <Text style={s.statVal}>{workout.exercises.length}</Text>
            <Text style={s.statLabel}>exercises</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.stat}>
            <Text style={s.statVal}>{totalSets(workout)}</Text>
            <Text style={s.statLabel}>sets</Text>
          </View>
          {volume > 0 && (
            <>
              <View style={s.statDivider} />
              <View style={s.stat}>
                <Text style={s.statVal}>{volume.toLocaleString()}</Text>
                <Text style={s.statLabel}>lbs total</Text>
              </View>
            </>
          )}
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={s.detail}>
          {workout.exercises.map((ex, ei) => (
            <View key={ei} style={s.exDetail}>
              <Text style={s.exName}>{ex.name}</Text>
              <Text style={s.exGroup}>{ex.muscleGroup}</Text>
              {ex.sets.map((set, si) => (
                <Text key={si} style={s.setLine}>
                  Set {si + 1}:{' '}
                  {set.weight > 0 ? `${set.weight} lbs` : 'Bodyweight'} × {set.reps} reps
                </Text>
              ))}
            </View>
          ))}
          <TouchableOpacity style={s.deleteBtn} onPress={onDelete}>
            <Text style={s.deleteTxt}>Delete Workout</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function HistoryScreen() {
  const [workouts, setWorkouts] = useState<SavedWorkout[]>([]);

  useFocusEffect(
    useCallback(() => {
      setWorkouts(getWorkouts());
    }, [])
  );

  function handleDelete(id: string) {
    deleteWorkout(id);
    setWorkouts(getWorkouts());
  }

  const totalVolumeAll = workouts.reduce((n, w) => n + totalVolume(w), 0);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>History</Text>
        <Text style={s.headerSub}>
          {workouts.length} workout{workouts.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {workouts.length > 1 && (
        <View style={s.summaryRow}>
          <View style={s.summaryItem}>
            <Text style={s.summaryVal}>{workouts.length}</Text>
            <Text style={s.summaryLabel}>Total Workouts</Text>
          </View>
          <View style={s.summaryItem}>
            <Text style={s.summaryVal}>
              {workouts.reduce((n, w) => n + totalSets(w), 0)}
            </Text>
            <Text style={s.summaryLabel}>Total Sets</Text>
          </View>
          <View style={s.summaryItem}>
            <Text style={s.summaryVal}>
              {totalVolumeAll > 0 ? `${(totalVolumeAll / 1000).toFixed(1)}k` : '—'}
            </Text>
            <Text style={s.summaryLabel}>Lbs Lifted</Text>
          </View>
        </View>
      )}

      {workouts.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>📋</Text>
          <Text style={s.emptyTitle}>No workouts yet</Text>
          <Text style={s.emptyText}>Completed workouts will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={workouts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <WorkoutCard workout={item} onDelete={() => handleDelete(item.id)} />
          )}
          contentContainerStyle={s.list}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    paddingTop: Platform.OS === 'web' ? 20 : 60,
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: BG,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: TEXT },
  headerSub: { fontSize: 13, color: SECONDARY, marginTop: 2 },

  summaryRow: {
    flexDirection: 'row',
    backgroundColor: CARD,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryVal: { fontSize: 22, fontWeight: 'bold', color: ACCENT },
  summaryLabel: { fontSize: 11, color: SECONDARY, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },

  list: { padding: 14 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  emptyIcon: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: TEXT, marginBottom: 8 },
  emptyText: { fontSize: 14, color: SECONDARY },

  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    paddingBottom: 8,
  },
  cardDate: { fontSize: 15, fontWeight: '600', color: TEXT },
  cardTime: { fontSize: 12, color: SECONDARY, marginTop: 2 },
  cardTopRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  duration: { fontSize: 12, color: SECONDARY },
  chevron: { fontSize: 11, color: SECONDARY },

  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 14,
    alignItems: 'center',
  },
  stat: { alignItems: 'center', minWidth: 56 },
  statVal: { fontSize: 20, fontWeight: 'bold', color: TEXT },
  statLabel: { fontSize: 10, color: SECONDARY, textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 1 },
  statDivider: { width: 1, height: 28, backgroundColor: '#2c2c2e', marginHorizontal: 14 },

  detail: {
    borderTopWidth: 1,
    borderTopColor: '#242424',
    padding: 16,
  },
  exDetail: { marginBottom: 14 },
  exName: { fontSize: 15, fontWeight: '600', color: TEXT },
  exGroup: { fontSize: 10, color: ACCENT, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 },
  setLine: { fontSize: 13, color: SECONDARY, lineHeight: 20 },

  deleteBtn: { marginTop: 6, paddingVertical: 10, alignItems: 'center' },
  deleteTxt: { color: RED, fontSize: 13, fontWeight: '600' },
});
