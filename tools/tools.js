const questionInput = document.getElementById("questionInput");
const answerInput = document.getElementById("answerInput");
const addCardBtn = document.getElementById("addCardBtn");

const flashcard = document.getElementById("flashcard");
const cardText = document.getElementById("cardText");

const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const flipBtn = document.getElementById("flipBtn");
const deleteBtn = document.getElementById("deleteBtn");

let flashcards = [];
let currentIndex = -1;
let showingAnswer = false;

function updateCard() {
    if (flashcards.length === 0) {
        cardText.textContent = "No flash cards yet!";
        return;
    }

    const currentCard = flashcards[currentIndex];
    cardText.textContent = showingAnswer ? currentCard.answer : currentCard.question;
}

addCardBtn.addEventListener("click", () => {
    const question = questionInput.value.trim();
    const answer = answerInput.value.trim();

    if (question === "" || answer === "") return;

    flashcards.push({ question, answer });
    currentIndex = flashcards.length - 1;
    showingAnswer = false;

    questionInput.value = "";
    answerInput.value = "";

    updateCard();
});

flipBtn.addEventListener("click", () => {
    if (flashcards.length === 0) return;
    showingAnswer = !showingAnswer;
    updateCard();
});

nextBtn.addEventListener("click", () => {
    if (flashcards.length === 0) return;
    currentIndex = (currentIndex + 1) % flashcards.length;
    showingAnswer = false;
    updateCard();
});

prevBtn.addEventListener("click", () => {
    if (flashcards.length === 0) return;
    currentIndex = (currentIndex - 1 + flashcards.length) % flashcards.length;
    showingAnswer = false;
    updateCard();
});

deleteBtn.addEventListener("click", () => {
    if (flashcards.length === 0) return;

    flashcards.splice(currentIndex, 1);

    if (flashcards.length === 0) {
        currentIndex = -1;
    } else {
        currentIndex = currentIndex % flashcards.length;
    }

    showingAnswer = false;
    updateCard();
});