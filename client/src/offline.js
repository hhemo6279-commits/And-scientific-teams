// أدوات وضع عدم الاتصال: تخزين محتوى الدروس محلياً في المتصفح
const KEY = 'mk_offline_lessons_v1';

export function saveLessonOffline(course, lesson) {
  try {
    const all = loadOfflineLessons();
    all[`${course.id}:${lesson.id}`] = {
      course_id: course.id,
      course_title: course.title,
      lesson_id: lesson.id,
      lesson_title: lesson.title,
      content: lesson.content || '',
      type: lesson.type || 'text',
      saved_at: new Date().toISOString(),
    };
    localStorage.setItem(KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

export function loadOfflineLessons() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

export function isLessonOffline(courseId, lessonId) {
  return Boolean(loadOfflineLessons()[`${courseId}:${lessonId}`]);
}

export function removeLessonOffline(courseId, lessonId) {
  const all = loadOfflineLessons();
  delete all[`${courseId}:${lessonId}`];
  localStorage.setItem(KEY, JSON.stringify(all));
}
