import { useState, useEffect, useCallback, useMemo } from 'react';
import { findSimilarCards, SimilarCard } from '../utils/fuzzyMatch';
import { BODY_SECTION_TAGS, getDisciplineTags, getExerciseSequenceTags, TAG_GROUPS } from '../utils/tags';
import { Card } from '../db/training-coach/types';

const FRONT_BACK_GROUP = TAG_GROUPS.frontBack;
const FREE_GLIDE_GROUP = TAG_GROUPS.freeGlide;
const UPPER_LOWER_GROUP = TAG_GROUPS.upperLower;

function isFrontBackTag(tag: string): tag is typeof FRONT_BACK_GROUP[number] {
  return (FRONT_BACK_GROUP as readonly string[]).includes(tag);
}

function isFreeGlideTag(tag: string): tag is typeof FREE_GLIDE_GROUP[number] {
  return (FREE_GLIDE_GROUP as readonly string[]).includes(tag);
}

function isUpperLowerTag(tag: string): tag is typeof UPPER_LOWER_GROUP[number] {
  return (UPPER_LOWER_GROUP as readonly string[]).includes(tag);
}

interface EditCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: Card;
  sectionTitle: string;
  sectionId: string;
  sections?: Array<{ id: string; title: string }>;
  deckDiscipline?: 'Spins' | 'Jumps' | 'Edges';
  onSave: (content: string, tags: string[], sectionId: string, priority: boolean, helpfulnessScore: number, title?: string) => Promise<void>;
  onDelete: () => Promise<void>;
  allCards: Array<{
    content: string;
    deckId: string;
    sectionId: string;
    id: string;
    helpfulnessScore: number;
    deckName?: string;
    createdAt?: number;
    sectionTitle?: string;
    tags?: string[];
  }>;
}

export default function EditCardModal({
  isOpen,
  onClose,
  card,
  sectionId,
  sectionTitle,
  sections,
  deckDiscipline,
  onSave,
  onDelete,
  allCards,
}: EditCardModalProps) {
  const [cardTitle, setCardTitle] = useState(card.title || '');
  const [cardText, setCardText] = useState(card.content);
  const [feeling, setFeeling] = useState('');
  const [issue, setIssue] = useState('');
  const [solution, setSolution] = useState('');
  const [selectedSequence, setSelectedSequence] = useState<string>('');
  const [selectedBodyTags, setSelectedBodyTags] = useState<string[]>([]);
  const [priority, setPriority] = useState(card.priority);
  const [helpfulnessScore, setHelpfulnessScore] = useState(card.helpfulnessScore);
  const [similarCards, setSimilarCards] = useState<SimilarCard[]>([]);
  const [showSimilar, setShowSimilar] = useState(false);
  const [tagError, setTagError] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>(sectionId);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Parse troubleshooting content into structured parts
  const parseTroubleshootingContent = (content: string) => {
    const parts: { feeling?: string; issue?: string; solution?: string } = {};
    const lines = content.split('\n\n');

    for (const line of lines) {
      if (line.startsWith('Feeling:')) {
        parts.feeling = line.replace(/^Feeling:\s*/, '');
      } else if (line.startsWith('Issue:')) {
        parts.issue = line.replace(/^Issue:\s*/, '');
      } else if (line.startsWith('Solution:')) {
        parts.solution = line.replace(/^Solution:\s*/, '');
      }
    }

    return parts;
  };

  // Initialize form from card data
  useEffect(() => {
    if (isOpen && card) {
      setCardTitle(card.title || '');
      setPriority(card.priority);
      setHelpfulnessScore(card.helpfulnessScore);
      setSelectedSectionId(sectionId);

      // Parse Troubleshooting content if it's a Troubleshooting card
      const selectedSection = sections?.find(s => s.id === sectionId);
      const currentSectionTitle = selectedSection?.title || sectionTitle;
      if (currentSectionTitle === 'Troubleshooting') {
        const parsed = parseTroubleshootingContent(card.content);
        setFeeling(parsed.feeling || '');
        setIssue(parsed.issue || '');
        setSolution(parsed.solution || '');
        setCardText(''); // Clear cardText for Troubleshooting
      } else {
        setCardText(card.content);
        setFeeling('');
        setIssue('');
        setSolution('');
      }

      // Extract sequence and body tags from card tags
      const cardTags = card.tags || [];
      const seqTag = cardTags.find(tag => TAG_GROUPS.sequence.includes(tag as typeof TAG_GROUPS.sequence[number]));
      setSelectedSequence(seqTag || '');

      const bodyTags = cardTags.filter(tag =>
        isFrontBackTag(tag) || isFreeGlideTag(tag) || isUpperLowerTag(tag)
      );
      setSelectedBodyTags(bodyTags);
    }
  }, [isOpen, card, sectionId, sectionTitle, sections]);

  const filteredCards = useMemo(() => {
    return allCards.filter(c => c.id !== card.id).filter(card => {
      if (selectedSequence && !card.tags?.includes(selectedSequence)) {
        return false;
      }
      if (selectedBodyTags.length > 0 && !selectedBodyTags.some(tag => card.tags?.includes(tag))) {
        return false;
      }
      return true;
    });
  }, [allCards, selectedSequence, selectedBodyTags, card.id]);

  const performFuzzySearch = useCallback(() => {
    const similar = findSimilarCards(cardText, filteredCards.map(c => ({
      content: c.content,
      deckId: c.deckId,
      sectionId: c.sectionId,
      id: c.id,
      helpfulnessScore: c.helpfulnessScore,
      deckName: c.deckName,
      createdAt: c.createdAt,
      sectionTitle: c.sectionTitle,
    })), 70);

    if (similar.length > 0) {
      setSimilarCards(similar);
      setShowSimilar(true);
    } else {
      setSimilarCards([]);
      setShowSimilar(false);
    }
  }, [cardText, filteredCards]);

  useEffect(() => {
    if (cardText.trim().length > 3) {
      const timeout = setTimeout(() => {
        performFuzzySearch();
      }, 500);
      return () => clearTimeout(timeout);
    } else {
      setSimilarCards([]);
      setShowSimilar(false);
    }
  }, [cardText, performFuzzySearch]);

  function toggleBodyTag(tagId: string) {
    setSelectedBodyTags(prev => {
      let newTags = [...prev];

      if (isFrontBackTag(tagId)) {
        newTags = newTags.filter(t => !isFrontBackTag(t));
      } else if (isFreeGlideTag(tagId)) {
        newTags = newTags.filter(t => !isFreeGlideTag(t));
      } else if (isUpperLowerTag(tagId)) {
        newTags = newTags.filter(t => !isUpperLowerTag(t));
      }

      if (newTags.includes(tagId)) {
        newTags = newTags.filter(t => t !== tagId);
      } else {
        newTags = [...newTags, tagId];
      }

      if (newTags.length > 0 || selectedSequence) {
        setTagError('');
      }

      return newTags;
    });
  }

  function toggleSequence(seqId: string) {
    if (selectedSequence === seqId) {
      setSelectedSequence('');
    } else {
      setSelectedSequence(seqId);
      setTagError('');
    }
  }

  async function handleSave() {
    const selectedSection = sections?.find(s => s.id === selectedSectionId);
    const currentSectionTitle = selectedSection?.title || sectionTitle;
    const isExercises = currentSectionTitle === 'Exercises';
    const isTroubleshooting = currentSectionTitle === 'Troubleshooting';
    const isReminders = currentSectionTitle === 'Reminders';

    // For Reminders, don't include body position tags
    const allTags = [
      ...(selectedSequence ? [selectedSequence] : []),
      ...(isReminders ? [] : selectedBodyTags),
    ];

    // Validate Troubleshooting fields
    if (isTroubleshooting) {
      if (!feeling.trim() || !issue.trim() || !solution.trim()) {
        setTagError('Please fill in all Troubleshooting fields: Feeling, Issue, and Solution.');
        return;
      }
    }

    // Validate Reminders: check for duplicate Part of Element (excluding current card)
    if (isReminders && selectedSequence) {
      const existingReminder = allCards.find(c =>
        c.id !== card.id && // Exclude current card
        c.sectionTitle === 'Reminders' &&
        c.sectionId === selectedSectionId &&
        c.tags?.includes(selectedSequence)
      );

      if (existingReminder) {
        const disciplineTags = deckDiscipline ? getDisciplineTags(deckDiscipline) : [];
        const sequenceTags = disciplineTags.filter(t =>
          TAG_GROUPS.sequence.includes(t.id as typeof TAG_GROUPS.sequence[number])
        ) || getExerciseSequenceTags();
        setTagError(`A Reminder card already exists for "${sequenceTags.find(t => t.id === selectedSequence)?.label || selectedSequence}". Please edit the existing card instead.`);
        return;
      }
    }

    // Validate body position tags: must have one from each group (unless it's exercises or reminders)
    if (!isExercises && !isReminders) {
      const hasFrontBack = selectedBodyTags.some(isFrontBackTag);
      const hasFreeGlide = selectedBodyTags.some(isFreeGlideTag);
      const hasUpperLower = selectedBodyTags.some(isUpperLowerTag);

      if (!hasFrontBack || !hasFreeGlide || !hasUpperLower) {
        setTagError('Please select one option from each group: Anterior/Posterior, Free Side/Skating Side, and Superior/Inferior.');
        return;
      }
    }

    // Validate sequence tag is required for Reminders, Troubleshooting, and Theory (optional for Exercises)
    if (!isExercises && !selectedSequence) {
      setTagError('Please select a Part of Element option. This field is required for Reminders, Troubleshooting, and Theory sections.');
      return;
    }

    // Format content based on section type
    let finalContent = '';
    if (isTroubleshooting) {
      finalContent = `Feeling: ${feeling.trim()}\n\nIssue: ${issue.trim()}\n\nSolution: ${solution.trim()}`;
    } else {
      finalContent = cardText.trim();
    }

    setTagError('');
    await onSave(finalContent, allTags, selectedSectionId, priority, helpfulnessScore, cardTitle.trim() || undefined);
    onClose();
  }

  async function handleDelete() {
    await onDelete();
    onClose();
  }

  if (!isOpen) return null;

  const selectedSection = sections?.find(s => s.id === selectedSectionId);
  const currentSectionTitle = selectedSection?.title || sectionTitle;
  const isExercises = currentSectionTitle === 'Exercises';
  const isReminders = currentSectionTitle === 'Reminders';
  const isTroubleshooting = currentSectionTitle === 'Troubleshooting';

  const disciplineTags = deckDiscipline ? getDisciplineTags(deckDiscipline) : [];
  // For exercises, use all exercise sequence tags
  // For other sections (Reminders, Troubleshooting, Theory), use discipline tags if available,
  // otherwise fall back to all sequence tags to ensure the field appears (since it's required)
  const sequenceTags = isExercises
    ? getExerciseSequenceTags()
    : (() => {
        const filtered = disciplineTags.filter(t =>
          TAG_GROUPS.sequence.includes(t.id as typeof TAG_GROUPS.sequence[number])
        );
        // If no discipline tags available, use all sequence tags (required field must be shown)
        return filtered.length > 0 ? filtered : getExerciseSequenceTags();
      })();

  // For Reminders, check which Part of Element options are already used (excluding current card)
  const usedReminderSequences = useMemo(() => {
    if (!isReminders) return new Set<string>();
    return new Set(
      allCards
        .filter(c =>
          c.id !== card.id && // Exclude current card
          c.sectionTitle === 'Reminders' &&
          c.sectionId === selectedSectionId &&
          c.tags?.some(tag => TAG_GROUPS.sequence.includes(tag as typeof TAG_GROUPS.sequence[number]))
        )
        .flatMap(c => c.tags || [])
        .filter(tag => TAG_GROUPS.sequence.includes(tag as typeof TAG_GROUPS.sequence[number]))
    );
  }, [allCards, isReminders, selectedSectionId, card.id]);

  const cardsByDeck = new Map<string, SimilarCard[]>();
  similarCards.forEach(card => {
    const deckName = card.deckName || 'Unknown Deck';
    if (!cardsByDeck.has(deckName)) {
      cardsByDeck.set(deckName, []);
    }
    cardsByDeck.get(deckName)!.push(card);
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[var(--z-modal)] flex items-center justify-center p-4">
      <div
        className="liquid-glass liquid-glass--card rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden"
        style={{
          maxHeight: 'calc(100svh - var(--deck-navbar-height) - var(--deck-settings-bar-height) - 4rem)',
          maxWidth: 'calc(100vw - 2rem)',
        }}
      >
        <div className="liquid-glass__content p-4 sm:p-6 max-h-[calc(100svh-var(--deck-navbar-height)-var(--deck-settings-bar-height)-4rem)] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">Edit Card</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-white/80 hover:text-white text-2xl transition-colors"
            >
              ×
            </button>
          </div>

          {sections && sections.length > 1 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-white/90 mb-2">
                Section <span className="text-red-400">*</span>
              </label>
              <select
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                className="w-full px-3 py-2 bg-black/30 backdrop-blur-sm border border-white/30 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
              >
                {sections.map(section => (
                  <option key={section.id} value={section.id} className="bg-gray-800">
                    {section.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Sequence Selection (Set/Load/Jump/Snap/Exit) - First for Reminders, before Title */}
          {sequenceTags.length > 0 && isReminders && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-white/90 mb-2">
                Part of Element <span className="text-red-400">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {sequenceTags.map(tag => {
                  const isUsed = usedReminderSequences.has(tag.id);
                  const isDisabled = isUsed && selectedSequence !== tag.id;
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => !isDisabled && toggleSequence(tag.id)}
                      disabled={isDisabled}
                      title={isDisabled ? 'Already created' : undefined}
                      className={`px-3 py-1 rounded text-sm transition-colors ${
                        isDisabled
                          ? 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                          : selectedSequence === tag.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-white/20 text-white hover:bg-white/30'
                      }`}
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Card Title */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-white/90 mb-2">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={cardTitle}
              onChange={(e) => setCardTitle(e.target.value)}
              className="w-full px-3 py-2 bg-black/30 backdrop-blur-sm border border-white/30 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-white/50"
              placeholder="Enter card title..."
            />
          </div>

          {/* Sequence Selection (Set/Load/Jump/Snap/Exit) - For non-Reminders sections */}
          {sequenceTags.length > 0 && !isReminders && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-white/90 mb-2">
                Part of Element {!isExercises && <span className="text-red-400">*</span>}
              </label>
              <div className="flex flex-wrap gap-2">
                {sequenceTags.map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleSequence(tag.id)}
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      selectedSequence === tag.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Troubleshooting Fields */}
          {isTroubleshooting ? (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Feeling <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={feeling}
                  onChange={(e) => setFeeling(e.target.value)}
                  className="w-full px-3 py-2 bg-black/30 backdrop-blur-sm border border-white/30 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-white/50"
                  rows={3}
                  placeholder="What do you feel in the moment? Where do you feel it?"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Issue <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={issue}
                  onChange={(e) => setIssue(e.target.value)}
                  className="w-full px-3 py-2 bg-black/30 backdrop-blur-sm border border-white/30 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-white/50"
                  rows={3}
                  placeholder="A succinct sentence describing the root cause."
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-white/90 mb-2">
                  Solution <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={solution}
                  onChange={(e) => setSolution(e.target.value)}
                  className="w-full px-3 py-2 bg-black/30 backdrop-blur-sm border border-white/30 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-white/50"
                  rows={3}
                  placeholder="How to fix the issue"
                />
              </div>
            </>
          ) : (
            /* Card Text - For non-Troubleshooting sections */
            <div className="mb-4">
              <label className="block text-sm font-medium text-white/90 mb-2">
                Card Text <span className="text-red-400">*</span>
              </label>
              <textarea
                value={cardText}
                onChange={(e) => setCardText(e.target.value)}
                className="w-full px-3 py-2 bg-black/30 backdrop-blur-sm border border-white/30 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-white/50"
                rows={3}
                placeholder="Enter your card content here..."
              />
            </div>
          )}

          {/* Body Tags - Not shown for Reminders or Exercises */}
          {!isReminders && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-white/90 mb-2">
                Body Position {!isExercises && <span className="text-red-400">*</span>}
                {!isExercises && <span className="text-xs text-white/70 ml-2">(Select one from each group)</span>}
              </label>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-white/70 mb-1">Frontal Plane:</p>
                <div className="flex flex-wrap gap-2">
                  {BODY_SECTION_TAGS.filter(tag => isFrontBackTag(tag.id)).map(tag => {
                    const isSelected = selectedBodyTags.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleBodyTag(tag.id)}
                        className={`px-3 py-1 rounded text-sm transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-white/20 text-white hover:bg-white/30'
                        }`}
                      >
                        {tag.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-xs text-white/70 mb-1">Median Plane:</p>
                <div className="flex flex-wrap gap-2">
                  {BODY_SECTION_TAGS.filter(tag => isFreeGlideTag(tag.id)).map(tag => {
                    const isSelected = selectedBodyTags.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleBodyTag(tag.id)}
                        className={`px-3 py-1 rounded text-sm transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-white/20 text-white hover:bg-white/30'
                        }`}
                      >
                        {tag.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-xs text-white/70 mb-1">Horizontal Plane:</p>
                <div className="flex flex-wrap gap-2">
                  {BODY_SECTION_TAGS.filter(tag => isUpperLowerTag(tag.id)).map(tag => {
                    const isSelected = selectedBodyTags.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleBodyTag(tag.id)}
                        className={`px-3 py-1 rounded text-sm transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-white/20 text-white hover:bg-white/30'
                        }`}
                      >
                        {tag.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-white/90 mb-2">
              Priority
            </label>
            {(() => {
              const isRestricted = currentSectionTitle === 'Troubleshooting' || currentSectionTitle === 'Theory';

              if (isRestricted) {
                // If moving to restricted section, clear priority
                if (priority) {
                  setPriority(false);
                }
                return (
                  <p className="text-sm text-white/70 italic">Priority is not available for {currentSectionTitle} sections.</p>
                );
              }

              return (
                <button
                  type="button"
                  onClick={() => setPriority(!priority)}
                  className={`px-4 py-2 rounded text-sm transition-colors ${
                    priority
                      ? 'bg-yellow-600 text-white'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  {priority ? 'Priority Set' : 'Set Priority'}
                </button>
              );
            })()}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-white/90 mb-2">
              Helpfulness Score
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setHelpfulnessScore(Math.max(0, helpfulnessScore - 1))}
                className="px-3 py-1 bg-white/20 text-white rounded hover:bg-white/30"
              >
                −
              </button>
              <span className="text-white text-lg font-bold min-w-[2rem] text-center">
                {helpfulnessScore}
              </span>
              <button
                type="button"
                onClick={() => setHelpfulnessScore(helpfulnessScore + 1)}
                className="px-3 py-1 bg-white/20 text-white rounded hover:bg-white/30"
              >
                +
              </button>
            </div>
          </div>

          {showSimilar && similarCards.length > 0 && (
            <div className="mb-4 p-4 bg-yellow-900/30 border border-yellow-500/50 rounded">
              <p className="text-sm font-medium text-yellow-200 mb-3">
                Similar cards found:
              </p>
              <div className="space-y-3">
                {Array.from(cardsByDeck.entries()).map(([deckName, cards]) => (
                  <div key={deckName} className="mb-3">
                    <p className="text-xs font-semibold text-white/90 mb-2">
                      Similar cards found in <span className="font-bold">{deckName}</span>
                    </p>
                    {cards
                      .sort((a, b) => (b.cardDate || 0) - (a.cardDate || 0))
                      .map(card => {
                        const isSameSection = card.sectionId === selectedSectionId;
                        return (
                          <div
                            key={card.cardId}
                            className="mb-2 p-2 rounded border border-white/20 bg-black/20"
                          >
                            <p className="text-sm text-white/90 mb-1">{card.content}</p>
                            <div className="flex items-center gap-2 flex-wrap text-xs">
                              <span className="px-2 py-0.5 rounded bg-white/20 text-white font-medium">
                                {card.sectionTitle || 'Unknown'}
                              </span>
                              {isSameSection && (
                                <span className="px-2 py-0.5 bg-blue-600 text-white rounded font-medium">
                                  Same Section
                                </span>
                              )}
                              <span className="text-white/70">
                                {Math.round(card.similarity)}% similar
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tagError && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded">
              <p className="text-red-200 text-sm">{tagError}</p>
            </div>
          )}

          <div className="flex justify-between gap-3 mt-6">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Delete
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-white/20 text-white rounded hover:bg-white/30 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={
                  !cardTitle.trim() ||
                  (isTroubleshooting ? (!feeling.trim() || !issue.trim() || !solution.trim()) : !cardText.trim())
                }
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:bg-gray-500/50 disabled:cursor-not-allowed"
              >
                Save Changes
              </button>
            </div>
          </div>

          {showDeleteConfirm && (
            <div className="mt-4 p-4 bg-red-900/30 border border-red-500/50 rounded">
              <p className="text-white mb-3">Are you sure you want to delete this card?</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 bg-white/20 text-white rounded hover:bg-white/30"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

