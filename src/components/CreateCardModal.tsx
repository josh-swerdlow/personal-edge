import { useState, useEffect, useCallback, useMemo } from 'react';
import { findSimilarCards, SimilarCard } from '../utils/fuzzyMatch';
import { BODY_SECTION_TAGS, getDisciplineTags, TAG_GROUPS } from '../utils/tags';

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

interface CreateCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  sectionTitle: string;
  sectionId: string;
  sections?: Array<{ id: string; title: string }>; // All sections in deck for dropdown
  deckDiscipline?: 'Spins' | 'Jumps' | 'Edges';
  onSave: (content: string, tags: string[], sectionId: string, onIce: boolean | null, createdAt?: number) => Promise<void>;
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

export default function CreateCardModal({
  isOpen,
  onClose,
  sectionTitle,
  sectionId,
  sections,
  deckDiscipline,
  onSave,
  allCards,
}: CreateCardModalProps) {
  const [cardText, setCardText] = useState('');
  const [selectedSequence, setSelectedSequence] = useState<string>('');
  const [selectedBodyTags, setSelectedBodyTags] = useState<string[]>([]);
  const [onIce, setOnIce] = useState<boolean | null>(null);
  const [similarCards, setSimilarCards] = useState<SimilarCard[]>([]);
  const [showSimilar, setShowSimilar] = useState(false);
  const [tagError, setTagError] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>(sectionId);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    // Default to today's date in YYYY-MM-DD format
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // Update selected section when sectionId prop changes
  useEffect(() => {
    setSelectedSectionId(sectionId);
  }, [sectionId]);

  useEffect(() => {
    if (!isOpen) {
      // Reset form when modal closes
      setCardText('');
      setSelectedSequence('');
      setSelectedBodyTags([]);
      setOnIce(null);
      setSimilarCards([]);
      setShowSimilar(false);
      setTagError('');
      setSelectedSectionId(sectionId); // Reset to initial section
      // Reset date to today when modal closes
      const today = new Date();
      setSelectedDate(today.toISOString().split('T')[0]);
    }
  }, [isOpen, sectionId]);

  const filteredCards = useMemo(() => {
    return allCards.filter(card => {
      if (selectedSequence && !card.tags?.includes(selectedSequence)) {
        return false;
      }
      if (selectedBodyTags.length > 0 && !selectedBodyTags.some(tag => card.tags?.includes(tag))) {
        return false;
      }
      return true;
    });
  }, [allCards, selectedSequence, selectedBodyTags]);

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

  // Perform fuzzy search when card text changes
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

      // Remove mutually exclusive tags
      if (isFrontBackTag(tagId)) {
        newTags = newTags.filter(t => !isFrontBackTag(t));
      } else if (isFreeGlideTag(tagId)) {
        newTags = newTags.filter(t => !isFreeGlideTag(t));
      } else if (isUpperLowerTag(tagId)) {
        newTags = newTags.filter(t => !isUpperLowerTag(t));
      }

      // Toggle the selected tag
      if (newTags.includes(tagId)) {
        newTags = newTags.filter(t => t !== tagId);
      } else {
        newTags = [...newTags, tagId];
      }

      // Clear error when tags are selected
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
      // Clear error when sequence is selected
      setTagError('');
    }
  }

  async function handleSave() {
    const allTags = [
      ...(selectedSequence ? [selectedSequence] : []),
      ...selectedBodyTags,
    ];

    // Validate body position tags: must have one from each group
    const hasFrontBack = selectedBodyTags.some(isFrontBackTag);
    const hasFreeGlide = selectedBodyTags.some(isFreeGlideTag);
    const hasUpperLower = selectedBodyTags.some(isUpperLowerTag);

    if (!hasFrontBack || !hasFreeGlide || !hasUpperLower) {
      setTagError('Please select one option from each group: Anterior/Posterior, Free Side/Skating Side, and Superior/Inferior.');
      return;
    }

    // Validate sequence tag is required
    if (!selectedSequence) {
      setTagError('Please select a sequence tag (Part of Element).');
      return;
    }

    // Convert selected date to Unix timestamp (start of day in local timezone)
    const dateObj = new Date(selectedDate);
    dateObj.setHours(0, 0, 0, 0);
    const createdAt = dateObj.getTime();

    setTagError('');
    await onSave(cardText.trim(), allTags, selectedSectionId, onIce, createdAt);
    onClose();
  }

  const selectedSection = sections?.find(s => s.id === selectedSectionId);
  const currentSectionTitle = selectedSection?.title || sectionTitle;

  if (!isOpen) return null;

  const disciplineTags = deckDiscipline ? getDisciplineTags(deckDiscipline) : [];
  const sequenceTags = disciplineTags.filter(t =>
    TAG_GROUPS.sequence.includes(t.id as typeof TAG_GROUPS.sequence[number])
  );

  // Group similar cards by deck
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
            <h2 className="text-xl font-bold text-white">Create Card</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-white/80 hover:text-white text-2xl transition-colors"
            >
              ×
            </button>
          </div>

          {/* Section Selection Dropdown */}
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

          {/* Card Text */}
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

          {/* Sequence Selection (Set/Load/Jump/Snap/Exit) */}
          {sequenceTags.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-white/90 mb-2">
                Part of Element <span className="text-red-400">*</span>
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

          {/* Body Tags */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-white/90 mb-2">
              Body Position <span className="text-red-400">*</span>
              <span className="text-xs text-white/70 ml-2">(Select one from each group)</span>
            </label>
            <div className="space-y-3">
              {/* Anterior/Posterior Group */}
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
              {/* Free Side/Skating Side Group */}
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
              {/* Superior/Inferior Group */}
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

          {/* Date Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-white/90 mb-2">
              Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 bg-black/30 backdrop-blur-sm border border-white/30 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
            />
          </div>

          {/* On/Off Ice */}
          {currentSectionTitle === 'Exercises' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-white/90 mb-2">
                Ice Type
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOnIce(onIce === true ? null : true)}
                  className={`px-4 py-2 rounded text-sm transition-colors ${
                    onIce === true
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  On Ice
                </button>
                <button
                  type="button"
                  onClick={() => setOnIce(onIce === false ? null : false)}
                  className={`px-4 py-2 rounded text-sm transition-colors ${
                    onIce === false
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  Off Ice
                </button>
              </div>
            </div>
          )}

          {/* Similar Cards Warning */}
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
                              {card.cardDate && (
                                <span className="text-white/70">
                                  {new Date(card.cardDate).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tag Validation Error */}
          {tagError && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded">
              <p className="text-red-200 text-sm">{tagError}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 mt-6">
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
              disabled={!cardText.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:bg-gray-500/50 disabled:cursor-not-allowed"
            >
              Save Card
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

