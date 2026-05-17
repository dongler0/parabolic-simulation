// =================================================================
// 1. 전역 변수 선언 (데이터 및 스위치 상자들)
// =================================================================
let pos, vel, acc;       
let dt = 0.005;          // 고정 시간 간격 (0.005s = 5ms) - 정확도 개선
let timeScale = 1.0;     // 재생 속도 배율 (1.0 = 실제 시간)
let elapsedTime = 0;     // 시뮬레이션 누적 시간
let accumulatedTime = 0; // 프레임 시간 누적
let history = [];        // 실시간 수집된 데이터 저장 배열

// 축척 설정: 초기 속도에 따라 동적 조정
let PIXELS_PER_METER = 10;

// 카메라(화면 패닝) 관련
let camOffsetX = 0; // world -> screen: screenX = worldX - camOffsetX
let btnPanCenter;
let viewScale = 1.0; // 렌더링 확대(1 = 100%)
let minScale = 0.2;
let maxScale = 8.0;
let isDragging = false;
let lastMouseX = 0;
let btnZoomIn, btnZoomOut;

// 월드<->스크린 좌표 변환 (균등 스케일, 지면(height-80)을 고정 기준으로 Y 스케일링)
function worldToScreenX(x) {
  return (x - camOffsetX) * viewScale;
}

function worldToScreenY(y) {
  let ground = height - 80;
  return ground - (ground - y) * viewScale;
}

function screenToWorldX(sx) {
  return sx / viewScale + camOffsetX;
}

function screenToWorldY(sy) {
  let ground = height - 80;
  return ground - (ground - sy) / viewScale;
}

// 시뮬레이션 제어 스위치
let isSimulating = false; 
let isPaused = false;     

// UI 입력창 및 버튼 변수들
let inputSpeed, inputAngle, inputInterval, inputGravity;
let btnStart, btnPause, togglePointsCheckbox;
let speedCheckboxFast, speedCheckboxNormal, speedCheckboxSlow;

// 최종 결과 표 출력을 위한 데이터 저장 상자
let finalResult = null;

// =================================================================
// 2. 초기 세팅 구역 (실험 공간 및 UI 배치)
// =================================================================
function setup() {
  createCanvas(1400, 750); 
  
  let currentTop = 760; 
  
  createP(' 시뮬레이션 조건 및 실험 설정').position(20, currentTop);
  
  // --- 1단 입력줄: 물리 법칙 기본값 설정 ---
  createSpan(' 초기 속도 ').position(10, currentTop + 40);
  createSpan('(m/s)').position(170, currentTop + 40);
  inputSpeed = createInput('15'); 
  inputSpeed.position(110, currentTop + 40).size(50);
  inputSpeed.input(validateSpeed);
  
  createSpan(' 발사 각도 ').position(230, currentTop + 40);
  createSpan('(도)').position(390, currentTop + 40);
  inputAngle = createInput('45');
  inputAngle.position(330, currentTop + 40).size(50);
  inputAngle.input(validateAngle);
  
  createSpan(' 중력 가속도 ').position(450, currentTop + 40);
  createSpan('(m/s²)').position(620, currentTop + 40);
  inputGravity = createInput('9.8'); 
  inputGravity.position(560, currentTop + 40).size(45);
  inputGravity.input(validateGravity);
  
  // --- 2단 입력줄: 데이터 트래킹 및 인터랙션 실험 설정 ---
  createSpan(' 데이터 기록 간격 ').position(20, currentTop + 80);
  createSpan('(초)').position(220, currentTop + 80);
  inputInterval = createInput('1.0'); 
  inputInterval.position(170, currentTop + 80).size(40);

  createSpan('공기저항을 포함하여 계산하지 않기 때문에 무게는 고려하지 않습니다.').position(600, currentTop + 80);

  togglePointsCheckbox = createCheckbox(' 기록된 데이터 점 화면에 표시하기', true);
  togglePointsCheckbox.position(300, currentTop + 80);

  //createSpan('재생 속도:').position(300, currentTop + 105);
  speedCheckboxFast = createCheckbox(' 빠른속도', false);
  speedCheckboxFast.position(300, currentTop + 105);
  speedCheckboxFast.changed(() => setPlaybackSpeed('fast'));
  speedCheckboxNormal = createCheckbox(' 정상속도', true);
  speedCheckboxNormal.position(390, currentTop + 105);
  speedCheckboxNormal.changed(() => setPlaybackSpeed('normal'));
  speedCheckboxSlow = createCheckbox(' 느린속도', false);
  speedCheckboxSlow.position(480, currentTop + 105);
  speedCheckboxSlow.changed(() => setPlaybackSpeed('slow'));
  
  // --- 3단 버튼줄: 제어 시스템 ---
  btnStart = createButton(' 시뮬레이션 시작');
  btnStart.position(20, currentTop + 130).size(150, 30);
  btnStart.mousePressed(resetSimulation);
  
  btnPause = createButton('⏸ 일시 정지');
  btnPause.position(180, currentTop + 130).size(110, 30);
  btnPause.mousePressed(togglePause); 

  // 중앙 복원 버튼
  btnPanCenter = createButton('⤺');
  btnPanCenter.position(300, currentTop + 130).size(40, 30);
  btnPanCenter.mousePressed(() => { camOffsetX = 0; viewScale = 1.0; });
}

// =================================================================
// 3. 물리 계산 및 데이터 UI 시각화 (초당 60번 무한 반복)
// =================================================================
function draw() {
  background(245); 
  // 키를 이용한 연속 패닝: 좌/우 방향키
  if (keyIsDown(37)) { // LEFT_ARROW
    camOffsetX = Math.max(0, camOffsetX - 6);
  }
  if (keyIsDown(39)) { // RIGHT_ARROW
    camOffsetX += 6;
  }
  
  // 레이아웃 분할선
  stroke(200);
  strokeWeight(1);
  line(1100, 0, 1100, height); 
  
  // 시뮬레이션 지면선
  stroke(80);
  strokeWeight(3);
  line(0, height - 80, 1100, height - 80); 
  
  fill(120);
  noStroke();
  textSize(11);
  text(`* PIXELS_PER_METER = ${PIXELS_PER_METER.toFixed(1)} (1m = ${PIXELS_PER_METER.toFixed(1)}px)`, 20, height - 25);
  
  // --- A. 실시간 물리 연산 및 데이터 수집 구간 ---
  if (isSimulating && !isPaused) {
    // 프레임 동안의 실제 시간을 누적 (재생 속도 배율 적용)
    accumulatedTime += deltaTime / 1000.0 * timeScale;
    
    // 누적된 시간이 dt보다 크면 고정 dt로 차은단 물리 연산 수행
    while (accumulatedTime >= dt) {
      // [원점 오차 수정]: t=0 상태 최초 1회 선행 주입
      if (history.length === 0) {
        let speedVal = float(inputSpeed.value());
        history.push({
          time: 0.0,                
          pixelX: pos.x,                         
          pixelY: pos.y,                         
          displayX: 0.0,    
          displayY: 0.0, 
          speed: speedVal,  
          isPoint: true     
        });
      }

      // 평지 및 공중 비행 연산 루프 진입
      if (pos.y < height - 80 || history.length === 1) {
        
        vel.add(p5.Vector.mult(acc, dt));
        pos.add(p5.Vector.mult(vel, dt));
        
        elapsedTime += dt;  // 누적 시간 정확히 갱신
        let currentTime = elapsedTime; 
        let userInterval = float(inputInterval.value());
        if (userInterval <= 0) userInterval = 1.0; 
        
        let isTargetInterval = false;
        let prevTime = history.length > 0 ? history[history.length - 1].time : 0;
        if (Math.floor(currentTime / userInterval) > Math.floor(prevTime / userInterval)) {
          isTargetInterval = true;
        }
        
        history.push({
          time: elapsedTime,                
          pixelX: pos.x,                         
          pixelY: pos.y,                         
          displayX: (pos.x - 50) / PIXELS_PER_METER,    
          displayY: (height - 80 - pos.y) / PIXELS_PER_METER, 
          speed: vel.mag() / PIXELS_PER_METER,                 
          isPoint: isTargetInterval         
        });
        
        // 💡 [수평 엇나감 해결 핵심 로직]
        if (history.length > 2 && pos.y >= height - 80) {
          isSimulating = false; 
          
          let currentData = history[history.length - 1];
          let prevData = history[history.length - 2];
          
          let targetY = height - 80;
          
          // 직전 프레임과 현재 프레임 사이에서 진짜 바닥에 도달했을 때의 선형 비율 계산
          let fraction = (targetY - prevData.pixelY) / (currentData.pixelY - prevData.pixelY);
          
          // 수직 높이를 위로 올린 만큼, 수평(X) 좌표와 시간도 정확하게 뒤로 감기
          let exactPixelX = prevData.pixelX + fraction * (currentData.pixelX - prevData.pixelX);
          let exactTime = prevData.time + fraction * (currentData.time - prevData.time);
          
          // 보정된 픽셀 X를 기반으로 수평 이동 거리(m) 역산
          let exactDisplayX = (exactPixelX - 50) / PIXELS_PER_METER;
          
          // 가짜 데이터를 진짜 종단 데이터로 교체
          history[history.length - 1] = {
            time: exactTime,
            pixelX: exactPixelX,
            pixelY: targetY,
            displayX: exactDisplayX,
            displayY: 0.0,         
            speed: currentData.speed, 
            isPoint: true        
          };
          
          let lastData = history[history.length - 1];
          finalResult = {
            time: lastData.time,
            distance: lastData.displayX
          };
        }
      }
      
      accumulatedTime -= dt; // 누적된 시간에서 dt 차감
    }
  }
  
  // --- B. 데이터 기반 궤적 연속선 그리기 ---
  noFill();
  stroke(180); 
  strokeWeight(2);
  beginShape();
  for (let data of history) {
    let sx = worldToScreenX(data.pixelX);
    let sy = worldToScreenY(data.pixelY);
    if (sx >= 0 && sx <= 1100) {
      vertex(sx, sy);
    }
  }
  endShape();
  
  // --- C. 스위치 상태에 따른 조건부 점 시각화 ---
  if (togglePointsCheckbox.checked()) {
    for (let data of history) {
      let sx = worldToScreenX(data.pixelX);
      let sy = worldToScreenY(data.pixelY);
      if (data.isPoint && sx >= 0 && sx <= 1100) {
        fill(255, 60, 60); 
        noStroke();
        ellipse(sx, sy, 8, 8); 
      }
    }
  }
  
  // --- D. 데이터 공학 UI: 마우스 오버 감지 및 물리 단위 팝업 ---
  for (let data of history) {
    let sx = worldToScreenX(data.pixelX);
    let sy = worldToScreenY(data.pixelY);
    if (data.isPoint && sx >= 0 && sx <= 1100) {
      let d = dist(mouseX, mouseY, sx, sy);
      
      if (d < 12) { 
        fill(0, 200, 100); 
        ellipse(sx, sy, 12, 12);
        
        fill(255, 255, 255, 240); 
        stroke(50);
        strokeWeight(1.5);
        
        let popupX = sx + 15;
        if (popupX > 900) popupX = sx - 200; 

        // 팝업은 스크린 좌표로 그리기
        rect(popupX, sy - 110, 185, 125, 8); 

        fill(0);
        noStroke();
        textSize(12);
        textStyle(BOLD);
        text(` [${data.time.toFixed(1)}s] 에서의 데이터`, popupX + 10, sy - 90);
        textStyle(NORMAL);
        
        text(` 수평 거리 : ${data.displayX.toFixed(1)} m`, popupX + 10, sy - 52); 
        text(` 수직 높이 : ${data.displayY.toFixed(1)} m`, popupX + 10, sy - 34);
        text(` 실시간 속도: ${data.speed.toFixed(1)} m/s`, popupX + 10, sy - 16);
        
        break; 
      }
    }
  }
  
  // --- E. 우측 영역에 최종 결과 표 그리기 ---
  drawResultTable();
}

function mousePressed() {
  if (mouseButton === LEFT && mouseY < height && mouseX < 1100) {
    isDragging = true;
    lastMouseX = mouseX;
  }
}

function mouseReleased() {
  isDragging = false;
}

function mouseDragged() {
  if (isDragging) {
    let dx = mouseX - lastMouseX;
    camOffsetX -= dx / viewScale; // move camera so that dragging moves world same direction
    if (camOffsetX < 0) camOffsetX = 0;
    lastMouseX = mouseX;
  }
}

function mouseWheel(event) {
  // zoom in/out centered at mouse position
  let oldScale = viewScale;
  if (event.delta < 0) {
    viewScale = constrain(viewScale * 1.1, minScale, maxScale);
  } else {
    viewScale = constrain(viewScale / 1.1, minScale, maxScale);
  }
  // keep world point under mouse stable
  let worldAtMouse = screenToWorldX(mouseX);
  camOffsetX = worldAtMouse - mouseX / viewScale;
  if (camOffsetX < 0) camOffsetX = 0;
  return false; // prevent page scroll
}

function setPlaybackSpeed(mode) {
  if (mode === 'fast') {
    timeScale = 3.0;
    speedCheckboxFast.checked(true);
    speedCheckboxNormal.checked(false);
    speedCheckboxSlow.checked(false);
  } else if (mode === 'normal') {
    timeScale = 1.0;
    speedCheckboxFast.checked(false);
    speedCheckboxNormal.checked(true);
    speedCheckboxSlow.checked(false);
  } else if (mode === 'slow') {
    timeScale = 0.5;
    speedCheckboxFast.checked(false);
    speedCheckboxNormal.checked(false);
    speedCheckboxSlow.checked(true);
  }
}

// 입력 유효성 검사 함수
function validateSpeed() {
  let v = parseFloat(inputSpeed.value());
  if (isNaN(v)) return;
  if (v > 150) {
    alert('초기 속도는 최대 150 m/s 입니다. 150 이하의 값을 입력해주세요.');
    inputSpeed.value('150');
  }
}

function validateAngle() {
  let a = parseFloat(inputAngle.value());
  if (isNaN(a)) return;
  if (a <= 0) {
    alert('발사 각도는 0도보다 커야 합니다. 0보다 큰 값을 입력해주세요.');
    inputAngle.value('1');
  } else if (a > 90) {
    alert('발사 각도는 최대 90도 입니다. 90 이하의 값을 입력해주세요.');
    inputAngle.value('90');
  }
}

function validateGravity() {
  let g = parseFloat(inputGravity.value());
  if (isNaN(g)) return;
  if (g <= 0) {
    alert('중력 가속도는 0보다 커야 합니다. 양수 값을 입력해주세요.');
    inputGravity.value('9.8');
  }
}

// =================================================================
// 5. 우측 표 렌더링 함수
// =================================================================
function drawResultTable() {
  let startX = 1125;
  let startY = 50;
  
  fill(50);
  noStroke();
  textStyle(BOLD);
  textSize(14);
  text(" 최종 바닥 낙하 결과 분석", startX, startY);
  
  fill(220, 230, 242);
  stroke(100);
  strokeWeight(1);
  rect(startX, startY + 15, 250, 30);
  
  fill(0);
  noStroke();
  textSize(12);
  text("구분", startX + 20, startY + 35);
  text("이론값 (공식)", startX + 90, startY + 35);
  text("실험값 (시뮬)", startX + 180, startY + 35);
  
  stroke(150);
  fill(255);
  rect(startX, startY + 45, 250, 40);
  
  fill(255);
  rect(startX, startY + 85, 250, 40);
  
  fill(50);
  noStroke();
  textStyle(BOLD);
  text("비행시간", startX + 10, startY + 69);
  text("도달거리", startX + 10, startY + 109);
  textStyle(NORMAL);
  
  let v0 = float(inputSpeed.value());
  let theta = radians(float(inputAngle.value()));
  let g = float(inputGravity.value());
  
  let vy0 = v0 * sin(theta);
  let vx0 = v0 * cos(theta);
  
  let theoreticalTime = (2 * v0 * sin(theta)) / g;
  let theoreticalDistance = vx0 * theoreticalTime;
  
  text(`${theoreticalTime.toFixed(2)} s`, startX + 100, startY + 69);
  text(`${theoreticalDistance.toFixed(1)} m`, startX + 100, startY + 109);
  
  if (finalResult !== null) {
    fill(255, 0, 0); 
    text(`${finalResult.time.toFixed(2)} s`, startX + 190, startY + 69);
    text(`${finalResult.distance.toFixed(1)} m`, startX + 190, startY + 109);
  } else {
    fill(150);
    text("대기 중...", startX + 190, startY + 69);
    text("대기 중...", startX + 190, startY + 109);
  }
}

// =================================================================
// 6. 기능 제어 함수들 (인터랙션 이벤트 처리)
// =================================================================
function togglePause() {
  if (!isSimulating) return; 
  isPaused = !isPaused; 
  
  if (isPaused) {
    btnPause.html(' 다시 시작');
  } else {
    btnPause.html(' 일시 정지');
  }
}

function resetSimulation() {
  history = []; 
  elapsedTime = 0;  // 누적 시간 초기화
  accumulatedTime = 0; // 프레임 시간 초기화
  isPaused = false;
  finalResult = null; 
  btnPause.html(' 일시 정지');
  
  let speed = float(inputSpeed.value());
  let angle = float(inputAngle.value());
  let gravityValue = float(inputGravity.value()); 

  // 입력값 유효성 검사(이중 안전망)
  if (isNaN(speed) || speed <= 0) {
    speed = 1.0;
    inputSpeed.value('1');
  }
  if (speed > 150) {
    alert('초기 속도는 최대 150 m/s 입니다. 150 이하의 값을 입력해주세요.');
    speed = 150;
    inputSpeed.value('150');
  }

  if (isNaN(angle) || angle <= 0) {
    alert('발사 각도는 0도보다 커야 합니다. 0보다 큰 값을 입력해주세요.');
    angle = 1;
    inputAngle.value('1');
  }
  if (angle > 90) {
    alert('발사 각도는 최대 90도 입니다. 90 이하의 값을 입력해주세요.');
    angle = 90;
    inputAngle.value('90');
  }

  if (isNaN(gravityValue) || gravityValue <= 0) {
    alert('중력 가속도는 0보다 커야 합니다. 양수 값을 입력해주세요.');
    gravityValue = 9.8;
    inputGravity.value('9.8');
  }
  
  // 초기 속도에 따른 동적 축척 조정
  // 초기 속도 15m/s를 기준으로 축척을 조정
  // 초기 속도가 빠르면 축척을 축소 (더 많은 범위를 표시)
  PIXELS_PER_METER = Math.max(3, 10 * (15 / speed));
  
  pos = createVector(50, height - 80);
  let angleRad = radians(-angle);
  vel = p5.Vector.fromAngle(angleRad).mult(speed * PIXELS_PER_METER);
  acc = createVector(0, gravityValue * PIXELS_PER_METER); 
  
  isSimulating = true; 
}
