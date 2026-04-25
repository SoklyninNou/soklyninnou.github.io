import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  SectionList,
  StyleSheet,
  Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import {
  getPendingWorkout,
  savePendingWorkout,
  clearPendingWorkout,
  saveWorkout,
} from '@/utils/storage';
import { EXERCISES, MUSCLE_GROUPS, Exercise } from '@/data/exercises';
import { PendingExercise, PendingSet, PendingWorkout, SavedWorkout } from '@/types/workout';

const ACCENT = '#4169e1';
const BG = '#0f0f0f';
const CARD = '#1c1c1e';
const ROW_BG = '#2c2c2e';
const TEXT = '#ffffff';
const SECONDARY = '#8e8e93';
const GREEN = '#22c55e';
const RED = '#ff453a';

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function defaultSets(): PendingSet[] {
  return [
    { reps: '', weight: '', completed: false },
    { reps: '', weight: '', completed: false },
    { reps: '', weight: '', completed: false },
  ];
}

export default function WorkoutLogScreen() {
  const [exercises, setExercises] = useState<PendingExercise[]>([]);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const pending = getPendingWorkout();
      if (pending) {
        setExercises(pending.exercises);
        setStartedAt(pending.startedAt);
      }
    }, [])
  );

  function persist(exs: PendingExercise[], started: string | null) {
    if (exs.length === 0) {
      clearPendingWorkout();
      return;
    }
    const s = started ?? new Date().toISOString();
    savePendingWorkout({ startedAt: s, exercises: exs });
  }

  function setExercisesAndSave(updated: PendingExercise[]) {
    setExercises(updated);
    persist(updated, startedAt);
  }

  function addExercise(exercise: Exercise) {
    const started = startedAt ?? new Date().toISOString();
    if (!startedAt) setStartedAt(started);
    const newEx: PendingExercise = {
      uid: makeId(),
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      sets: defaultSets(),
    };
    const updated = [...exercises, newEx];
    setExercises(updated);
    savePendingWorkout({ startedAt: started, exercises: updated });
    setShowPicker(false);
    setSearchQuery('');
  }

  function removeExercise(uid: string) {
    setExercisesAndSave(exercises.filter((e) => e.uid !== uid));
  }

  function addSet(uid: string) {
    setExercisesAndSave(
      exercises.map((e) =>
        e.uid === uid
          ? { ...e, sets: [...e.sets, { reps: '', weight: '', completed: false }] }
          : e
      )
    );
  }

  function updateSet(uid: string, si: number, field: 'reps' | 'weight', value: string) {
    setExercisesAndSave(
      exercises.map((e) =>
        e.uid === uid
          ? { ...e, sets: e.sets.map((s, i) => (i === si ? { ...s, [field]: value } : s)) }
          : e
      )
    );
  }

  function toggleDone(uid: string, si: number) {
    setExercisesAndSave(
      exercises.map((e) =>
        e.uid === uid
          ? { ...e, sets: e.sets.map((s, i) => (i === si ? { ...s, completed: !s.completed } : s)) }
          : e
      )
    );
  }

  function finishWorkout() {
    const now = new Date();
    const started = startedAt ? new Date(startedAt) : now;
    const durationMinutes = Math.max(0, Math.round((now.getTime() - started.getTime()) / 60000));

    const workout: SavedWorkout = {
      id: makeId(),
      date: now.toISOString(),
      durationMinutes,
      exercises: exercises
        .map((e) => ({
          name: e.name,
          muscleGroup: e.muscleGroup,
          sets: e.sets
            .filter((s) => s.reps || s.weight)
            .map((s) => ({
              reps: parseInt(s.reps) || 0,
              weight: parseFloat(s.weight) || 0,
            })),
        }))
        .filter((e) => e.sets.length > 0),
    };

    saveWorkout(workout);
    clearPendingWorkout();
    setExercises([]);
    setStartedAt(null);
    setShowConfirm(false);
  }

  function discardWorkout() {
    clearPendingWorkout();
    setExercises([]);
    setStartedAt(null);
    setShowConfirm(false);
  }

  const filteredSections = MUSCLE_GROUPS.map((group) => ({
    title: group,
    data: EXERCISES.filter(
      (e) =>
        e.muscleGroup === group &&
        e.name.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((s) => s.data.length > 0);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  });

  const completedSets = exercises.reduce(
    (n, e) => n + e.sets.filter((s) => s.completed).length,
    0
  );
  const totalSets = exercises.reduce((n, e) => n + e.sets.length, 0);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Workout Log</Text>
          <Text style={s.headerDate}>{today}</Text>
        </View>
        {exercises.length > 0 && (
          <Text style={s.setsProgress}>
            {completedSets}/{totalSets} sets
          </Text>
        )}
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
        {exercises.length === 0 && (
          <View style={s.emptyState}>
            <Text style={s.emptyIcon}>🏋️</Text>
            <Text style={s.emptyTitle}>No exercises yet</Text>
            <Text style={s.emptyText}>Tap "Add Exercise" to start logging your workout.</Text>
          </View>
        )}

        {exercises.map((exercise) => (
          <View key={exercise.uid} style={s.card}>
            <View style={s.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.exerciseName}>{exercise.name}</Text>
                <Text style={s.muscleGroup}>{exercise.muscleGroup}</Text>
              </View>
              <TouchableOpacity onPress={() => removeExercise(exercise.uid)} hitSlop={8}>
                <Text style={s.removeEx}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={s.setHeader}>
              <Text style={[s.setHeaderText, s.colSet]}>SET</Text>
              <Text style={[s.setHeaderText, s.colWeight]}>LBS</Text>
              <Text style={[s.setHeaderText, s.colReps]}>REPS</Text>
              <View style={s.colDone} />
            </View>

            {exercise.sets.map((set, si) => (
              <View key={si} style={[s.setRow, set.completed && s.setRowDone]}>
                <Text style={[s.colSet, s.setNum, set.completed && s.dimText]}>{si + 1}</Text>
                <TextInput
                  style={[s.input, s.colWeight, set.completed && s.inputDone]}
                  value={set.weight}
                  onChangeText={(v) => updateSet(exercise.uid, si, 'weight', v)}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor="#444"
                  editable={!set.completed}
                  selectTextOnFocus
                />
                <TextInput
                  style={[s.input, s.colReps, set.completed && s.inputDone]}
                  value={set.reps}
                  onChangeText={(v) => updateSet(exercise.uid, si, 'reps', v)}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor="#444"
                  editable={!set.completed}
                  selectTextOnFocus
                />
                <TouchableOpacity
                  style={[s.colDone, s.doneBtn, set.completed && s.doneBtnActive]}
                  onPress={() => toggleDone(exercise.uid, si)}
                >
                  <Text style={[s.doneIcon, set.completed && s.doneIconActive]}>
                    {set.completed ? '✓' : '○'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={s.addSetRow} onPress={() => addSet(exercise.uid)}>
              <Text style={s.addSetText}>+ Add Set</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={s.addExBtn} onPress={() => setShowPicker(true)}>
          <Text style={s.addExText}>+ Add Exercise</Text>
        </TouchableOpacity>

        {exercises.length > 0 && (
          <TouchableOpacity style={s.finishBtn} onPress={() => setShowConfirm(true)}>
            <Text style={s.finishText}>Finish Workout</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Exercise Picker */}
      <Modal visible={showPicker} animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Add Exercise</Text>
            <TouchableOpacity onPress={() => { setShowPicker(false); setSearchQuery(''); }}>
              <Text style={s.modalClose}>Done</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={s.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search exercises…"
            placeholderTextColor="#555"
            autoFocus
          />
          {filteredSections.length === 0 ? (
            <View style={s.noResults}>
              <Text style={s.noResultsText}>No exercises found</Text>
            </View>
          ) : (
            <SectionList
              sections={filteredSections}
              keyExtractor={(item, i) => `${item.name}-${i}`}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.exItem} onPress={() => addExercise(item)}>
                  <Text style={s.exItemName}>{item.name}</Text>
                  <Text style={s.exItemGroup}>{item.muscleGroup}</Text>
                </TouchableOpacity>
              )}
              renderSectionHeader={({ section }) => (
                <View style={s.sectionHead}>
                  <Text style={s.sectionHeadText}>{section.title}</Text>
                </View>
              )}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>
      </Modal>

      {/* Finish Confirm */}
      <Modal visible={showConfirm} animationType="fade" transparent onRequestClose={() => setShowConfirm(false)}>
        <View style={s.overlay}>
          <View style={s.confirmBox}>
            <Text style={s.confirmTitle}>Finish Workout?</Text>
            <Text style={s.confirmSub}>
              {exercises.length} exercise{exercises.length !== 1 ? 's' : ''} · {completedSets} completed sets
            </Text>
            <TouchableOpacity style={s.saveBtn} onPress={finishWorkout}>
              <Text style={s.saveBtnText}>Save Workout</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.keepBtn} onPress={() => setShowConfirm(false)}>
              <Text style={s.keepBtnText}>Keep Going</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.discardBtn} onPress={discardWorkout}>
              <Text style={s.discardBtnText}>Discard Workout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: Platform.OS === 'web' ? 20 : 60,
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: BG,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: TEXT },
  headerDate: { fontSize: 13, color: SECONDARY, marginTop: 2 },
  setsProgress: { fontSize: 13, color: ACCENT, fontWeight: '600' },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 80 },

  emptyState: { alignItems: 'center', paddingVertical: 64 },
  emptyIcon: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: TEXT, marginBottom: 8 },
  emptyText: { fontSize: 14, color: SECONDARY, textAlign: 'center', paddingHorizontal: 32 },

  card: { backgroundColor: CARD, borderRadius: 14, padding: 16, marginBottom: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  exerciseName: { fontSize: 17, fontWeight: '600', color: TEXT },
  muscleGroup: { fontSize: 11, color: ACCENT, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 3 },
  removeEx: { fontSize: 15, color: RED, paddingLeft: 8 },

  setHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  setHeaderText: { fontSize: 10, fontWeight: '700', color: SECONDARY, letterSpacing: 0.8, textAlign: 'center' },
  colSet: { width: 28 },
  colWeight: { flex: 1, marginHorizontal: 5 },
  colReps: { flex: 1, marginHorizontal: 5 },
  colDone: { width: 38, alignItems: 'center' },

  setRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 7 },
  setRowDone: { opacity: 0.45 },
  setNum: { fontSize: 14, color: SECONDARY, fontWeight: '600', textAlign: 'center' },
  dimText: { color: '#444' },

  input: {
    backgroundColor: ROW_BG,
    color: TEXT,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 9,
    fontSize: 15,
    textAlign: 'center',
  },
  inputDone: { color: '#444' },

  doneBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: ROW_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnActive: { backgroundColor: GREEN },
  doneIcon: { fontSize: 15, color: SECONDARY },
  doneIconActive: { color: '#fff', fontWeight: '700' },

  addSetRow: { alignSelf: 'center', paddingVertical: 8, marginTop: 2 },
  addSetText: { color: ACCENT, fontSize: 13, fontWeight: '600' },

  addExBtn: {
    borderWidth: 1,
    borderColor: ACCENT,
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  addExText: { color: ACCENT, fontSize: 15, fontWeight: '600' },

  finishBtn: { backgroundColor: ACCENT, borderRadius: 14, padding: 16, alignItems: 'center' },
  finishText: { color: TEXT, fontSize: 16, fontWeight: 'bold' },

  // Modal – picker
  modal: { flex: 1, backgroundColor: BG },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'web' ? 20 : 60,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: TEXT },
  modalClose: { fontSize: 15, color: ACCENT, fontWeight: '600' },
  searchInput: {
    backgroundColor: ROW_BG,
    color: TEXT,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    margin: 14,
    marginBottom: 6,
  },
  noResults: { flex: 1, alignItems: 'center', paddingTop: 40 },
  noResultsText: { color: SECONDARY, fontSize: 15 },
  sectionHead: {
    backgroundColor: BG,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  sectionHeadText: {
    color: ACCENT, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase',
  },
  exItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: CARD,
    borderBottomWidth: 1,
    borderBottomColor: '#242424',
  },
  exItemName: { fontSize: 15, color: TEXT },
  exItemGroup: { fontSize: 12, color: SECONDARY },

  // Modal – confirm
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmBox: {
    backgroundColor: CARD,
    borderRadius: 18,
    padding: 24,
    width: '100%',
    maxWidth: 360,
  },
  confirmTitle: { fontSize: 22, fontWeight: 'bold', color: TEXT, marginBottom: 6 },
  confirmSub: { fontSize: 14, color: SECONDARY, marginBottom: 24, lineHeight: 20 },
  saveBtn: { backgroundColor: ACCENT, borderRadius: 12, padding: 15, alignItems: 'center', marginBottom: 10 },
  saveBtnText: { color: TEXT, fontWeight: 'bold', fontSize: 16 },
  keepBtn: { backgroundColor: ROW_BG, borderRadius: 12, padding: 15, alignItems: 'center', marginBottom: 10 },
  keepBtnText: { color: TEXT, fontSize: 16 },
  discardBtn: { padding: 12, alignItems: 'center' },
  discardBtnText: { color: RED, fontSize: 14 },
});
