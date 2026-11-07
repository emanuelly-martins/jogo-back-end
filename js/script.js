// ==========================================
// EVENT LOOP 3D LEGO
// Sistema principal do jogo
// ==========================================


// ==========================================
// 1. ELEMENTOS HTML
// ==========================================

const container = document.getElementById("webgl-container");

const welcomeModal = document.getElementById("welcome-modal");
const phaseModal = document.getElementById("phase-modal");
const glossaryModal = document.getElementById("glossary-modal");
const tutorialModal = document.getElementById("tutorial-modal");

const threadStatus = document.getElementById("ui-thread-status");
const phaseDisplay = document.getElementById("ui-phase");
const healthDisplay = document.getElementById("ui-health");
const scoreDisplay = document.getElementById("ui-score");
const holdingDisplay = document.getElementById("ui-holding");

const hintText = document.getElementById("action-hint-text");
const toast = document.getElementById("toast-notif");
const toastText = document.getElementById("toast-text");
const cpuWarning = document.getElementById("cpu-warning");

const modalTitle = document.getElementById("modal-title");
const modalDescription = document.getElementById("modal-description");
const modalAnalogy = document.getElementById("modal-analogy-text");
const modalObjective = document.getElementById("modal-objective");
const modalPhaseTag = document.getElementById("modal-phase-tag");


// ==========================================
// 2. CONFIGURAÇÕES DO JOGO
// ==========================================

const TOTAL_PHASES = 4;

let currentPhase = 1;
let score = 0;
let health = 3;

let gameStarted = false;
let gameOver = false;

let keys = {};

let player;
let playerSpeed = 5;

let carriedOrder = null;
let activeOrders = [];

let callbacksReady = [];
let pendingCallbacks = 0;

let nearbyObject = null;
let movementTarget = null;

let toastTimeout;
let warningTimeout;

const clock = new THREE.Clock();


// ==========================================
// 3. INFORMAÇÕES DAS FASES
// ==========================================

const phases = [

    {
        title: "FASE 1: CALL STACK",

        description:
            "Você precisa atender os pedidos que chegam às mesas. A Call Stack representa as tarefas que o garçom executa uma de cada vez.",

        analogy:
            "Imagine que sua bandeja só comporta uma tarefa por vez. Você precisa terminar uma antes de começar outra.",

        objective:
            "Atenda os pedidos simples e entenda como funciona a execução sequencial."
    },

    {
        title: "FASE 2: ASYNC E LIBUV",

        description:
            "Agora alguns pedidos demoram mais para ficar prontos. O garçom deve encaminhá-los para a cozinha e continuar livre para outras tarefas.",

        analogy:
            "A cozinha representa o trabalho delegado para os bastidores. Enquanto o prato fica pronto, o garçom pode continuar trabalhando.",

        objective:
            "Identifique os pedidos demorados e encaminhe-os para a cozinha."
    },

    {
        title: "FASE 3: CALLBACK QUEUE",

        description:
            "Os pedidos que terminaram na cozinha voltam para uma fila de callbacks. O Event Loop permite que o garçom pegue esses resultados quando a Call Stack estiver livre.",

        analogy:
            "A esteira recebe os pratos prontos. O garçom precisa buscar cada um e entregar na mesa correta.",

        objective:
            "Busque os callbacks disponíveis e entregue os resultados aos clientes."
    },

    {
        title: "FASE 4: EVENT LOOP E CPU",

        description:
            "Chegou o desafio final! Você precisa organizar as tarefas sem bloquear a thread principal. Operações pesadas de CPU podem prejudicar o atendimento.",

        analogy:
            "Se o garçom tentar fazer todo o trabalho pesado sozinho no salão, ninguém mais será atendido. É preciso organizar as tarefas corretamente.",

        objective:
            "Finalize todos os pedidos, evite bloqueios e mantenha o SLA dos clientes."
    }

];


// ==========================================
// 4. CONFIGURAÇÃO DO THREE.JS
// ==========================================

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x090d16);

scene.fog = new THREE.Fog(0x090d16, 18, 38);

const camera = new THREE.PerspectiveCamera(
    55,
    1,
    0.1,
    100
);

camera.position.set(0, 15, 17);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({
    antialias: true
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

renderer.outputEncoding = THREE.sRGBEncoding;

container.appendChild(renderer.domElement);


// ==========================================
// 5. ILUMINAÇÃO
// ==========================================

const ambientLight = new THREE.AmbientLight(
    0xffffff,
    0.7
);

scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(
    0xffffff,
    1.5
);

mainLight.position.set(-5, 12, 8);
mainLight.castShadow = true;

scene.add(mainLight);

const cyanLight = new THREE.PointLight(
    0x00f3ff,
    2,
    15
);

cyanLight.position.set(-6, 4, -3);
scene.add(cyanLight);

const pinkLight = new THREE.PointLight(
    0xff007f,
    2,
    15
);

pinkLight.position.set(6, 4, 0);
scene.add(pinkLight);


// ==========================================
// 6. MATERIAIS
// ==========================================

function material(color, extra = {}) {

    return new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.7,
        ...extra
    });

}

const materials = {

    floor: material(0x172033),

    wall: material(0x26334a),

    cyan: material(0x00f3ff, {
        emissive: 0x003c44
    }),

    yellow: material(0xffd500, {
        emissive: 0x554000
    }),

    pink: material(0xff007f, {
        emissive: 0x440020
    }),

    blue: material(0x258cff, {
        emissive: 0x001c55
    }),

    red: material(0xff3333),

    white: material(0xffffff),

    black: material(0x111827),

    skin: material(0xffcc33),

    green: material(0x22cc77)

};


// ==========================================
// 7. FUNÇÃO PARA CRIAR CUBOS
// ==========================================

function createBox(
    width,
    height,
    depth,
    mat,
    x,
    y,
    z
) {

    const geometry = new THREE.BoxGeometry(
        width,
        height,
        depth
    );

    const mesh = new THREE.Mesh(
        geometry,
        mat
    );

    mesh.position.set(x, y, z);

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    scene.add(mesh);

    return mesh;

}


// ==========================================
// 8. CENÁRIO DO RESTAURANTE
// ==========================================

// Piso

const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 18),
    materials.floor
);

floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;

scene.add(floor);


// Grade decorativa

const grid = new THREE.GridHelper(
    22,
    22,
    0x00f3ff,
    0x26334a
);

grid.position.y = 0.02;
scene.add(grid);


// Paredes do restaurante

createBox(22, 3, 0.3, materials.wall, 0, 1.5, -9);

createBox(0.3, 3, 18, materials.wall, -11, 1.5, 0);

createBox(0.3, 3, 18, materials.wall, 11, 1.5, 0);


// Letreiro da cozinha

createBox(
    5,
    0.6,
    0.2,
    materials.cyan,
    6,
    3,
    -5
);


// ==========================================
// 9. CRIAÇÃO DAS MESAS
// ==========================================

const tables = [];

const tablePositions = [

    { x: -7, z: -3 },

    { x: -7, z: 3 },

    { x: 0, z: -5 }

];


function createTable(index, position) {

    const group = new THREE.Group();

    group.position.set(
        position.x,
        0,
        position.z
    );

    // Tampo

    const top = new THREE.Mesh(
        new THREE.BoxGeometry(2.5, 0.3, 2),
        materials.yellow
    );

    top.position.y = 1.2;
    top.castShadow = true;

    group.add(top);

    // Pés

    const legPositions = [

        [-1, 0.5, -0.75],
        [1, 0.5, -0.75],
        [-1, 0.5, 0.75],
        [1, 0.5, 0.75]

    ];

    legPositions.forEach(pos => {

        const leg = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 1, 0.2),
            materials.black
        );

        leg.position.set(
            pos[0],
            pos[1],
            pos[2]
        );

        group.add(leg);

    });

    scene.add(group);

    const table = {

        id: index + 1,

        group: group,

        position: new THREE.Vector3(
            position.x,
            0,
            position.z
        ),

        orderMarker: null,

        order: null

    };

    tables.push(table);

    return table;

}


tablePositions.forEach((position, index) => {

    createTable(index, position);

});


// ==========================================
// 10. CRIAÇÃO DA COZINHA LIBUV
// ==========================================

const kitchen = new THREE.Group();

kitchen.position.set(6, 0, 0);

const kitchenCounter = new THREE.Mesh(
    new THREE.BoxGeometry(4, 1.2, 2),
    materials.blue
);

kitchenCounter.position.y = 0.6;
kitchenCounter.castShadow = true;

kitchen.add(kitchenCounter);


// Tampo da cozinha

const kitchenTop = new THREE.Mesh(
    new THREE.BoxGeometry(4.3, 0.2, 2.3),
    materials.cyan
);

kitchenTop.position.y = 1.3;

kitchen.add(kitchenTop);

scene.add(kitchen);


// Letreiro da cozinha

function createTextLabel(text, color, position) {

    const canvas = document.createElement("canvas");

    canvas.width = 512;
    canvas.height = 128;

    const ctx = canvas.getContext("2d");

    ctx.fillStyle = color;
    ctx.font = "bold 55px Arial";
    ctx.textAlign = "center";
    ctx.fillText(text, 256, 80);

    const texture = new THREE.CanvasTexture(canvas);

    const label = new THREE.Mesh(

        new THREE.PlaneGeometry(4, 1),

        new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true
        })

    );

    label.position.set(
        position.x,
        position.y,
        position.z
    );

    scene.add(label);

    return label;

}

createTextLabel(
    "COZINHA LIBUV",
    "#00f3ff",
    { x: 6, y: 2.8, z: -1.2 }
);


// ==========================================
// 11. CRIAÇÃO DO GARÇOM LEGO
// ==========================================

function createWaiter() {

    const character = new THREE.Group();

    // Pernas

    const leftLeg = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.7, 0.35),
        materials.blue
    );

    leftLeg.position.set(-0.2, 0.35, 0);

    character.add(leftLeg);

    const rightLeg = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.7, 0.35),
        materials.blue
    );

    rightLeg.position.set(0.2, 0.35, 0);

    character.add(rightLeg);


    // Corpo

    const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.8, 0.5),
        materials.white
    );

    body.position.y = 1.1;

    character.add(body);


    // Cabeça

    const head = new THREE.Mesh(
        new THREE.CylinderGeometry(
            0.38,
            0.38,
            0.65,
            16
        ),

        materials.skin
    );

    head.position.y = 1.85;

    character.add(head);


    // Cabelo

    const hair = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.18, 0.65),
        materials.black
    );

    hair.position.y = 2.25;

    character.add(hair);


    // Olhos

    const eyeMaterial = material(0x111111);

    const leftEye = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.06, 0.04),
        eyeMaterial
    );

    leftEye.position.set(-0.13, 1.9, -0.37);

    character.add(leftEye);

    const rightEye = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.06, 0.04),
        eyeMaterial
    );

    rightEye.position.set(0.13, 1.9, -0.37);

    character.add(rightEye);


    // Braços

    const leftArm = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.7, 0.25),
        materials.white
    );

    leftArm.position.set(-0.58, 1.1, 0);

    character.add(leftArm);

    const rightArm = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.7, 0.25),
        materials.white
    );

    rightArm.position.set(0.58, 1.1, 0);

    character.add(rightArm);


    // Gravata

    const tie = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.45, 0.08),
        materials.red
    );

    tie.position.set(0, 1.15, -0.3);

    character.add(tie);


    character.position.set(0, 0, 5);

    character.traverse(object => {

        if (object.isMesh) {

            object.castShadow = true;

        }

    });

    scene.add(character);

    return character;

}

player = createWaiter();


// ==========================================
// 12. CRIAR PEDIDOS
// ==========================================

function createOrderMarker(table, heavy) {

    const color = heavy ? 0xff007f : 0x00f3ff;

    const marker = new THREE.Mesh(

        new THREE.BoxGeometry(0.65, 0.65, 0.65),

        new THREE.MeshStandardMaterial({

            color: color,

            emissive: color,

            emissiveIntensity: 0.6

        })

    );

    marker.position.set(
        table.position.x,
        2,
        table.position.z
    );

    scene.add(marker);

    table.orderMarker = marker;

}


function createPhaseOrders() {

    activeOrders = [];

    callbacksReady = [];

    carriedOrder = null;

    pendingCallbacks = 0;

    const patterns = [

        [false, true, false],

        [true, false, true],

        [true, true, false],

        [true, true, true]

    ];

    const currentPattern = patterns[currentPhase - 1];

    tables.forEach((table, index) => {

        if (table.orderMarker) {

            scene.remove(table.orderMarker);

            table.orderMarker = null;

        }

        const order = {

            id: index + 1,

            table: table,

            heavy: currentPattern[index],

            status: "waiting",

            timer: 0

        };

        table.order = order;

        activeOrders.push(order);

        createOrderMarker(
            table,
            order.heavy
        );

    });

}


// ==========================================
// 13. ATUALIZAÇÃO DA INTERFACE
// ==========================================

function updateInterface() {

    phaseDisplay.textContent =
        currentPhase + " / " + TOTAL_PHASES;

    scoreDisplay.textContent = score;

    healthDisplay.innerHTML = "";

    for (let i = 0; i < 3; i++) {

        const heart = document.createElement("span");

        heart.textContent = i < health ? "❤️" : "🖤";

        healthDisplay.appendChild(heart);

    }

    if (carriedOrder) {

        holdingDisplay.textContent =
            carriedOrder.heavy
                ? "Callback / Pedido pesado"
                : "Pedido simples";

    } else {

        holdingDisplay.textContent = "Vazio";

    }

}


// ==========================================
// 14. STATUS DA THREAD
// ==========================================

function setThreadStatus(status) {

    threadStatus.textContent = status;

    if (status === "BUSY") {

        threadStatus.className =
            "font-pixel text-[10px] text-red-400 animate-pulse";

    } else {

        threadStatus.className =
            "font-pixel text-[10px] text-green-400 animate-pulse";

    }

}


// ==========================================
// 15. NOTIFICAÇÕES
// ==========================================

function showToast(message) {

    toastText.textContent = message;

    toast.classList.remove("hidden");

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {

        toast.classList.add("hidden");

    }, 2500);

}


function showWarning() {

    cpuWarning.classList.remove("hidden");

    clearTimeout(warningTimeout);

    warningTimeout = setTimeout(() => {

        cpuWarning.classList.add("hidden");

    }, 2500);

}


// ==========================================
// 16. APRESENTAÇÃO DAS FASES
// ==========================================

function showPhaseIntroduction() {

    const phase = phases[currentPhase - 1];

    modalTitle.textContent = phase.title;

    modalDescription.textContent = phase.description;

    modalAnalogy.textContent = phase.analogy;

    modalObjective.textContent = phase.objective;

    modalPhaseTag.textContent =
        "FASE " + currentPhase;

    phaseModal.classList.remove("hidden");

}


// ==========================================
// 17. INICIAR FASE
// ==========================================

function startPhase() {

    phaseModal.classList.add("hidden");

    gameStarted = true;

    gameOver = false;

    createPhaseOrders();

    updateInterface();

    showToast("FASE " + currentPhase + " INICIADA!");

    updateHint();

}


// ==========================================
// 18. VERIFICAR DISTÂNCIA
// ==========================================

function getDistance(positionA, positionB) {

    return Math.sqrt(

        Math.pow(positionA.x - positionB.x, 2) +

        Math.pow(positionA.z - positionB.z, 2)

    );

}


function findNearbyObject() {

    nearbyObject = null;

    let closestDistance = Infinity;

    tables.forEach(table => {

        const distance = getDistance(
            player.position,
            table.position
        );

        if (distance < 2.2 && distance < closestDistance) {

            nearbyObject = table;

            closestDistance = distance;

        }

    });

    const kitchenPosition = new THREE.Vector3(6, 0, 0);

    const kitchenDistance = getDistance(
        player.position,
        kitchenPosition
    );

    if (
        kitchenDistance < 3 &&
        kitchenDistance < closestDistance
    ) {

        nearbyObject = "kitchen";

    }

}


// ==========================================
// 19. ATUALIZAR DICAS
// ==========================================

function updateHint() {

    if (!gameStarted) return;

    if (carriedOrder) {

        if (carriedOrder.status === "carrying") {

            if (carriedOrder.heavy) {

                hintText.textContent =
                    "Leve o pedido até a COZINHA LIBUV e pressione ESPAÇO.";

            } else {

                hintText.textContent =
                    "Leve o pedido até a mesa e pressione ESPAÇO.";

            }

        }

        else if (carriedOrder.status === "callbackReady") {

            hintText.textContent =
                "Callback pronto! Volte à mesa " +
                carriedOrder.table.id +
                " e pressione ESPAÇO.";

        }

        else if (carriedOrder.status === "returning") {

            hintText.textContent =
                "Volte à mesa " +
                carriedOrder.table.id +
                " para entregar o pedido!";

        }

        return;

    }

    if (nearbyObject === "kitchen") {

        if (callbacksReady.length > 0) {

            hintText.textContent =
                "Callback disponível! Pressione ESPAÇO para buscar.";

        } else {

            hintText.textContent =
                "Cozinha Libuv: aguardando pedidos.";

        }

        return;

    }

    if (nearbyObject) {

        if (nearbyObject.order.status === "waiting") {

            hintText.textContent =
                "Mesa " + nearbyObject.id +
                ": pressione ESPAÇO para pegar o pedido.";

        } else {

            hintText.textContent =
                "Esta mesa já foi atendida.";

        }

        return;

    }

    hintText.textContent =
        "Aproxime-se de uma mesa ou da cozinha.";

}


// ==========================================
// 20. PEGAR PEDIDOS
// ==========================================

function pickOrder(table) {

    const order = table.order;

    if (!order || order.status !== "waiting") {

        return;

    }

    carriedOrder = order;

    order.status = "carrying";

    if (table.orderMarker) {

        scene.remove(table.orderMarker);

        table.orderMarker = null;

    }

    showToast("PEDIDO " + order.id + " COLETADO!");

    updateInterface();

    updateHint();

}


// ==========================================
// 21. ENVIAR PEDIDO PARA A COZINHA
// ==========================================

function sendToKitchen() {

    if (!carriedOrder || !carriedOrder.heavy) {

        return;

    }

    const order = carriedOrder;

    order.status = "processing";

    carriedOrder = null;

    pendingCallbacks++;

    setThreadStatus("IDLE");

    updateInterface();

    showToast("PEDIDO ENVIADO PARA A LIBUV!");

    updateHint();


    // Simulação de operação assíncrona.
    // A thread principal continua livre.

    setTimeout(() => {

        order.status = "callbackReady";

        callbacksReady.push(order);

        pendingCallbacks--;

        showToast(
            "CALLBACK DO PEDIDO " + order.id + " PRONTO!"
        );

        if (gameStarted) {

            setThreadStatus("IDLE");

            updateHint();

        }

    }, 3500);

}


// ==========================================
// 22. BUSCAR CALLBACK
// ==========================================

function collectCallback() {

    if (callbacksReady.length === 0) {

        showToast("NENHUM CALLBACK DISPONÍVEL!");

        return;

    }

    carriedOrder = callbacksReady.shift();

    carriedOrder.status = "returning";

    showToast("CALLBACK COLETADO!");

    updateInterface();

    updateHint();

}


// ==========================================
// 23. ENTREGAR PEDIDO
// ==========================================

function deliverOrder(order) {

    if (!order) return;

    order.status = "completed";

    score += 10;

    carriedOrder = null;

    updateInterface();

    showToast("PEDIDO ENTREGUE! +10 PONTOS");

    updateHint();

    checkPhaseCompletion();

}


// ==========================================
// 24. SISTEMA DE INTERAÇÃO
// ==========================================

function interact() {

    if (!gameStarted || gameOver) return;

    findNearbyObject();


    // Jogador está carregando um pedido

    if (carriedOrder) {

        // Pedido pesado chegando à cozinha

        if (
            carriedOrder.heavy &&
            carriedOrder.status === "carrying" &&
            nearbyObject === "kitchen"
        ) {

            sendToKitchen();

            return;

        }


        // Callback pronto sendo entregue na mesa

        if (
            carriedOrder.status === "returning" &&
            nearbyObject === carriedOrder.table
        ) {

            deliverOrder(carriedOrder);

            return;

        }


        // Pedido simples

        if (
            !carriedOrder.heavy &&
            nearbyObject === carriedOrder.table
        ) {

            deliverOrder(carriedOrder);

            return;

        }


        showToast("VÁ ATÉ O LOCAL INDICADO!");

        return;

    }


    // Jogador está na cozinha

    if (nearbyObject === "kitchen") {

        collectCallback();

        return;

    }


    // Jogador está próximo de uma mesa

    if (nearbyObject && nearbyObject.order) {

        pickOrder(nearbyObject);

        return;

    }

}


// ==========================================
// 25. VERIFICAR FIM DA FASE
// ==========================================

function checkPhaseCompletion() {

    const allCompleted = activeOrders.every(order => {

        return order.status === "completed";

    });

    if (!allCompleted) return;

    if (pendingCallbacks > 0) return;

    if (currentPhase < TOTAL_PHASES) {

        gameStarted = false;

        currentPhase++;

        showToast("FASE CONCLUÍDA!");

        setTimeout(() => {

            showPhaseIntroduction();

        }, 1200);

    } else {

        finishGame();

    }

}


// ==========================================
// 26. FINALIZAR JOGO
// ==========================================

function finishGame() {

    gameStarted = false;

    gameOver = true;

    phaseModal.classList.remove("hidden");

    modalPhaseTag.textContent = "CONCLUÍDO";

    modalTitle.textContent = "🏆 RESTAURANTE CONCLUÍDO!";

    modalDescription.textContent =
        "Você conseguiu atender todos os clientes e completar as quatro fases do Event Loop!";

    modalAnalogy.textContent =
        "Agora você conhece a jornada dos pedidos: Call Stack, operações assíncronas, callbacks e Event Loop.";

    modalObjective.textContent =
        "Pontuação final: " + score + " pontos. Parabéns pelo atendimento!";

    const startButton = document.getElementById("btn-start-phase");

    startButton.textContent = "JOGAR NOVAMENTE ➔";

}


// ==========================================
// 27. REINICIAR JOGO
// ==========================================

function restartGame() {

    currentPhase = 1;

    score = 0;

    health = 3;

    carriedOrder = null;

    callbacksReady = [];

    pendingCallbacks = 0;

    gameOver = false;

    player.position.set(0, 0, 5);

    movementTarget = null;

    setThreadStatus("IDLE");

    updateInterface();

    const startButton = document.getElementById("btn-start-phase");

    startButton.textContent = "INICIAR FASE ➔";

    showPhaseIntroduction();

}


// ==========================================
// 28. MOVIMENTAÇÃO DO PERSONAGEM
// ==========================================

function movePlayer(delta) {

    if (!gameStarted || gameOver) return;

    let moveX = 0;
    let moveZ = 0;

    if (keys["w"] || keys["ArrowUp"]) {

        moveZ -= 1;

    }

    if (keys["s"] || keys["ArrowDown"]) {

        moveZ += 1;

    }

    if (keys["a"] || keys["ArrowLeft"]) {

        moveX -= 1;

    }

    if (keys["d"] || keys["ArrowRight"]) {

        moveX += 1;

    }


    const moving = moveX !== 0 || moveZ !== 0;

    if (moving) {

        const length = Math.sqrt(
            moveX * moveX + moveZ * moveZ
        );

        moveX /= length;
        moveZ /= length;

        player.position.x += moveX * playerSpeed * delta;

        player.position.z += moveZ * playerSpeed * delta;

        player.rotation.y = Math.atan2(
            moveX,
            moveZ
        );

        movementTarget = null;

    }


    // Limites do restaurante

    player.position.x = THREE.MathUtils.clamp(
        player.position.x,
        -9.5,
        9.5
    );

    player.position.z = THREE.MathUtils.clamp(
        player.position.z,
        -7.5,
        7.5
    );


    // Movimento por clique no chão

    if (movementTarget && !moving) {

        const dx = movementTarget.x - player.position.x;

        const dz = movementTarget.z - player.position.z;

        const distance = Math.sqrt(dx * dx + dz * dz);

        if (distance > 0.15) {

            player.position.x +=
                (dx / distance) * playerSpeed * delta;

            player.position.z +=
                (dz / distance) * playerSpeed * delta;

            player.rotation.y = Math.atan2(dx, dz);

        } else {

            movementTarget = null;

        }

    }

}


// ==========================================
// 29. CÂMERA SEGUINDO O GARÇOM
// ==========================================

function updateCamera() {

    const targetPosition = new THREE.Vector3(

        player.position.x,

        0,

        player.position.z

    );

    camera.position.x +=
        (player.position.x * 0.45 - camera.position.x) * 0.04;

    camera.position.z +=
        (player.position.z + 13 - camera.position.z) * 0.04;

    camera.position.y +=
        (15 - camera.position.y) * 0.04;

    camera.lookAt(
        targetPosition.x,
        0,
        targetPosition.z
    );

}


// ==========================================
// 30. CONTROLES DO TECLADO
// ==========================================

window.addEventListener("keydown", event => {

    const key = event.key;

    if (
        key === "ArrowUp" ||
        key === "ArrowDown" ||
        key === "ArrowLeft" ||
        key === "ArrowRight" ||
        key === " "
    ) {

        event.preventDefault();

    }

    keys[key.toLowerCase()] = true;

    if (key === " ") {

        interact();

    }

});


window.addEventListener("keyup", event => {

    keys[event.key.toLowerCase()] = false;

});


// ==========================================
// 31. MOVIMENTAÇÃO PELO CLIQUE
// ==========================================

const raycaster = new THREE.Raycaster();

const pointer = new THREE.Vector2();

renderer.domElement.addEventListener("click", event => {

    if (!gameStarted) return;

    const rect = renderer.domElement.getBoundingClientRect();

    pointer.x =
        ((event.clientX - rect.left) / rect.width) * 2 - 1;

    pointer.y =
        -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);

    const intersects = raycaster.intersectObject(floor);

    if (intersects.length > 0) {

        const point = intersects[0].point;

        movementTarget = new THREE.Vector3(
            point.x,
            0,
            point.z
        );

    }

});


// ==========================================
// 32. ANIMAÇÃO DOS PEDIDOS
// ==========================================

function animateOrders(time) {

    tables.forEach(table => {

        if (table.orderMarker) {

            table.orderMarker.position.y =
                2 + Math.sin(time * 0.003) * 0.2;

            table.orderMarker.rotation.y += 0.015;

        }

    });

}


// ==========================================
// 33. SISTEMA SLA
// ==========================================

let slaTimer = 0;

function updateSLA(delta) {

    if (!gameStarted) return;

    slaTimer += delta;

    if (slaTimer >= 20) {

        slaTimer = 0;

        if (health > 0) {

            health--;

            updateInterface();

            showToast("ATENÇÃO! SLA PREJUDICADO!");

        }

    }

}


// ==========================================
// 34. REDIMENSIONAMENTO DA TELA
// ==========================================

function resizeGame() {

    const width = container.clientWidth;

    const height = container.clientHeight;

    if (!width || !height) return;

    camera.aspect = width / height;

    camera.updateProjectionMatrix();

    renderer.setSize(width, height);

}

window.addEventListener("resize", resizeGame);

resizeGame();


// ==========================================
// 35. SISTEMA PRINCIPAL DE ANIMAÇÃO
// ==========================================

function animate(time) {

    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.05);

    movePlayer(delta);

    updateCamera();

    findNearbyObject();

    updateHint();

    animateOrders(time);

    updateSLA(delta);

    renderer.render(scene, camera);

}

animate(0);


// ==========================================
// 36. BOTÕES E MENUS
// ==========================================


// Abrir manual

document.getElementById("btn-manual-open")
    .addEventListener("click", () => {

        welcomeModal.classList.remove("hidden");

    });


// Fechar manual e continuar

document.getElementById("btn-welcome-ok")
    .addEventListener("click", () => {

        welcomeModal.classList.add("hidden");

        if (gameOver) {

            restartGame();

        } else {

            showPhaseIntroduction();

        }

    });


// Iniciar fase

document.getElementById("btn-start-phase")
    .addEventListener("click", () => {

        if (gameOver) {

            restartGame();

        } else {

            startPhase();

        }

    });


// Abrir dicionário

document.getElementById("btn-glossary-open")
    .addEventListener("click", () => {

        glossaryModal.classList.remove("hidden");

    });


// Fechar dicionário

function closeGlossary() {

    glossaryModal.classList.add("hidden");

}

document.getElementById("btn-glossary-close")
    .addEventListener("click", closeGlossary);

document.getElementById("btn-glossary-ok")
    .addEventListener("click", closeGlossary);


// Abrir tutorial

document.getElementById("btn-tutorial-open")
    .addEventListener("click", () => {

        tutorialModal.classList.remove("hidden");

    });


// Fechar tutorial

function closeTutorial() {

    tutorialModal.classList.add("hidden");

}

document.getElementById("btn-tutorial-close")
    .addEventListener("click", closeTutorial);

document.getElementById("btn-tutorial-ok")
    .addEventListener("click", closeTutorial);


// ==========================================
// 37. INICIALIZAÇÃO
// ==========================================

updateInterface();

setThreadStatus("IDLE");

console.log("EVENT LOOP 3D LEGO iniciado!");

console.log("Three.js carregado:", THREE.REVISION);

console.log("Aguardando o jogador...");