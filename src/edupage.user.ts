// ==UserScript==
// @name         New Userscript
// @namespace    http://tampermonkey.net/
// @version      2026-11-06
// @description  try to take over the world!
// @author       You
// @match        https://*/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// ==/UserScript==



/**
 * Počká, kým sa v DOMe objavia elementy zodpovedajúce selektoru, a vráti ich všetky.
 * 
 * @param selector - CSS selektor pre hľadané elementy (napr. '.chat-message').
 * @param minCount - Minimálny počet elementov, ktoré musia existovať, aby funkcia skončila (predvolene 1).
 * @param timeout - Voliteľný časový limit v milisekundách, po ktorom hľadanie zlyhá.
 * @returns Promise, ktorá vráti pole nájdených HTMLElementov.
 */
function waitForAllElements<T extends HTMLElement = HTMLElement>(
  selector: string,
  minCount: number = 1,
  timeout?: number
): Promise<T[]> {
  return new Promise((resolve, reject) => {

    // Pomocná funkcia, ktorá skontroluje aktuálny stav v DOMe
    const checkElements = (observerToDisconnect?: MutationObserver) => {
      const elements = Array.from(document.querySelectorAll<T>(selector));

      // Ak sme našli požadovaný minimálny počet elementov, končíme úspechom
      if (elements.length >= minCount) {
        if (observerToDisconnect) observerToDisconnect.disconnect();
        clearTimeout(timer);
        resolve(elements);
        return true;
      }
      return false;
    };

    // 1. Ak elementy v DOMe už sú v dostatočnom počte, vrátime ich ihneď
    if (checkElements()) return;

    // 2. Ak nie, začneme sledovať zmeny v DOMe
    const observer = new MutationObserver((_, obs) => {
      checkElements(obs);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // 3. Voliteľné: Časový limit (Timeout)
    let timer: number | undefined;
    if (timeout) {
      timer = window.setTimeout(() => {
        observer.disconnect();
        const currentElements = Array.from(document.querySelectorAll<T>(selector));
        reject(
          new Error(
            `Časový limit vypršal. Našlo sa iba ${currentElements.length} z požadovaných ${minCount} elementov pre selektor "${selector}".`
          )
        );
      }, timeout);
    }
  });
}

function copyElement(originalButton: HTMLButtonElement) {
  // 1. Získajte pôvodný element s explicitným určením typu (napr. HTMLButtonElement)

  // Kontrola, či element v DOM-e skutočne existuje
  if (!originalButton) {
    return
  }

  // 2. Naklonujte ho a pretypujte z 'Node' na konkrétny HTML element
  const clonedButton = originalButton.cloneNode(true) as HTMLButtonElement;

  // 3. Zmeňte ID (TypeScript by inak hlásil chybu, ak by ste pracovali s čistým Node)
  clonedButton.id = 'new-button';

  // Kópia je teraz bez listenerov. Môžete jej pridať úplne nový, ak chcete:

  originalButton.parentElement?.insertBefore(clonedButton, originalButton)

  return clonedButton
}

function vytvorOverlay(zoznamTextov: string[]): void {
  // 1. Hlavný kontajner pre overlay
  const overlay: HTMLDivElement = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
  overlay.style.zIndex = '99999';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.gap = '20px';
  overlay.style.fontFamily = 'Arial, sans-serif';

  // 2. Tlačidlo na zatvorenie
  const zavrietBtn: HTMLButtonElement = document.createElement('button');
  zavrietBtn.innerText = '✕ Zatvoriť';
  zavrietBtn.style.position = 'absolute';
  zavrietBtn.style.top = '20px';
  zavrietBtn.style.right = '20px';
  zavrietBtn.style.padding = '10px 15px';
  zavrietBtn.style.fontSize = '16px';
  zavrietBtn.style.cursor = 'pointer';
  zavrietBtn.style.backgroundColor = '#ff4d4d';
  zavrietBtn.style.color = 'white';
  zavrietBtn.style.border = 'none';
  zavrietBtn.style.borderRadius = '5px';

  zavrietBtn.onclick = (): void => overlay.remove();
  overlay.appendChild(zavrietBtn);

  // 3. Samostatný kontajner pre tlačidlá (uľahčuje flexibilné preusporiadanie)
  const buttonsContainer: HTMLDivElement = document.createElement('div');
  buttonsContainer.style.display = 'flex';
  buttonsContainer.style.flexDirection = 'column';
  buttonsContainer.style.gap = '15px';
  buttonsContainer.style.alignItems = 'center';
  overlay.appendChild(buttonsContainer);

  // 4. Pole objektov, kde si držíme referenciu na element aj jeho aktuálny stav kliknutí
  const tlacidlaData: Array<{ element: HTMLButtonElement; clicks: number }> = [];

  // Funkcia, ktorá kompletne preusporiada DOM elementy v kontajneri na základe počtu kliknutí (vzostupne)
  const reorderButtons = (): void => {
    // Zoradenie poľa dát vzostupne (clicks: 0 -> 1 -> 2...)
    tlacidlaData.sort((a, b) => a.clicks - b.clicks);

    // Znovu pridáme elementy do kontajnera v novom poradí (netreba ich mazať, appendChild ich automaticky presunie)
    tlacidlaData.forEach(item => buttonsContainer.appendChild(item.element));
  };

  // 5. Vytvorenie tlačidiel
  zoznamTextov.forEach((text: string): void => {
    const tlacidlo: HTMLButtonElement = document.createElement('button');
    tlacidlo.innerText = `${text} (0)`;
    tlacidlo.style.padding = '12px 24px';
    tlacidlo.style.fontSize = '18px';
    tlacidlo.style.cursor = 'pointer';
    tlacidlo.style.minWidth = '240px';
    tlacidlo.style.border = 'none';
    tlacidlo.style.borderRadius = '5px';
    tlacidlo.style.backgroundColor = '#007bff';
    tlacidlo.style.color = 'white';
    tlacidlo.style.transition = 'background-color 0.2s, transform 0.2s';

    // Objekt pre sledovanie stavu daného tlačidla
    const stavTlacitka = { element: tlacidlo, clicks: 0 };
    tlacidlaData.push(stavTlacitka);

    tlacidlo.onmouseenter = (): string => tlacidlo.style.backgroundColor = '#0056b3';
    tlacidlo.onmouseleave = (): string => tlacidlo.style.backgroundColor = '#007bff';

    // Logika po kliknutí
    tlacidlo.onclick = (): void => {
      stavTlacitka.clicks++;
      tlacidlo.innerText = `${text} (${stavTlacitka.clicks})`;

      // Okamžité spustenie nového zoradenia
      reorderButtons();
    };
  });

  // Prvotné zoradenie a vykreslenie (všetky majú na začiatku 0)
  reorderButtons();

  // 6. Pridanie celého overlay do stránky
  document.body.appendChild(overlay);
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    // Pridajte výkričníky všade, kde pristupujete k indexom
    [shuffled[i]!, shuffled[j]!] = [shuffled[j]!, shuffled[i]!];
  }

  return shuffled;
}

async function init() {
  const students = await waitForAllElements('.student .name')
  const names = shuffleArray(students.map(s => s.innerHTML))
  console.log(names)
  const closeButton = document.querySelector('[role=dialog]:has(.student .name) button[title=Close]')
  closeButton?.addEventListener('click', () => {
    init()
  })

  setTimeout(() => {
    const saveButton = document.querySelector('[role=dialog]:has(.student .name) .asc-button-container:has(.button-green)') as HTMLButtonElement | null
    if (!saveButton) {
      return
    }

    const newButton = copyElement(saveButton)?.firstElementChild
    if (!newButton) {
      return
    }

    newButton.classList.remove('button-green')
    newButton.classList.add('button-blue')
    newButton.innerHTML = 'Vyvolávanie'
    newButton.addEventListener('click', () => {
      vytvorOverlay(names)
    })
  }, 1000)
}

init()

