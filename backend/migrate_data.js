const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

// Supabase configuration (using service role key for full access)
const supabaseUrl = 'https://aniddaigsdcbjnmncxhl.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuaWRkYWlnc2RjYmpubW5jeGhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDY0ODM4NiwiZXhwIjoyMDc2MjI0Mzg2fQ.Zpm9--9apR3MznI_wWA40xdUEh70UhZRZZHjcMiFkbo';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CockroachDB configuration
const cockroachConfig = {
  connectionString: process.env.COCKROACHDB_URL || 'postgresql://marijeeducativa:uBQQSwn-pWNygC3SvlRx1Q@navy-python-17387.j77.aws-us-east-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full'
};

async function migrateData() {
  const cockroachClient = new Client(cockroachConfig);

  try {
    console.log('Connecting to databases...');
    await cockroachClient.connect();
    console.log('✅ Connected to CockroachDB');

    // Migrate users
    console.log('Migrating users...');
    const { data: users, error: usersError } = await supabase
      .from('usuarios')
      .select('*');

    if (usersError) {
      console.error('Error fetching users:', usersError);
    } else {
      for (const user of users) {
        await cockroachClient.query(
          'INSERT INTO usuarios (id, email, nombre_completo, rol, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
          [user.id, user.email, user.nombre_completo, user.rol, user.created_at, user.updated_at]
        );
      }
      console.log(`✅ Migrated ${users.length} users`);
    }

    // Migrate groups
    console.log('Migrating groups...');
    const { data: groups, error: groupsError } = await supabase
      .from('grupos')
      .select('*');

    if (groupsError) {
      console.error('Error fetching groups:', groupsError);
    } else {
      for (const group of groups) {
        await cockroachClient.query(
          'INSERT INTO grupos (id, nivel, grado, seccion, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
          [group.id, group.nivel, group.grado, group.seccion, group.created_at, group.updated_at]
        );
      }
      console.log(`✅ Migrated ${groups.length} groups`);
    }

    // Migrate subjects
    console.log('Migrating subjects...');
    const { data: subjects, error: subjectsError } = await supabase
      .from('asignaturas')
      .select('*');

    if (subjectsError) {
      console.error('Error fetching subjects:', subjectsError);
    } else {
      for (const subject of subjects) {
        await cockroachClient.query(
          'INSERT INTO asignaturas (id, nombre, created_at, updated_at) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
          [subject.id, subject.nombre, subject.created_at, subject.updated_at]
        );
      }
      console.log(`✅ Migrated ${subjects.length} subjects`);
    }

    // Migrate courses
    console.log('Migrating courses...');
    const { data: courses, error: coursesError } = await supabase
      .from('cursos')
      .select('*', { count: 'exact', head: false });

    if (coursesError) {
      console.error('Error fetching courses:', coursesError);
    } else {
      console.log(`Found ${courses ? courses.length : 0} courses to migrate`);
      let migratedCourses = 0;
      if (courses && courses.length > 0) {
        for (const course of courses) {
          try {
            console.log(`Migrating course: ${course.id}, grupo: ${course.grupo_id}, asignatura: ${course.asignatura_id}`);
            await cockroachClient.query(
              'INSERT INTO cursos (id, grupo_id, asignatura_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
              [course.id, course.grupo_id, course.asignatura_id, course.created_at, course.updated_at]
            );
            migratedCourses++;
          } catch (error) {
            console.error(`Error migrating course ${course.id}:`, error.message);
          }
        }
      }
      console.log(`✅ Migrated ${migratedCourses} courses`);
    }

    // Migrate students
    console.log('Migrating students...');
    const { data: students, error: studentsError } = await supabase
      .from('estudiantes')
      .select('*');

    if (studentsError) {
      console.error('Error fetching students:', studentsError);
    } else {
      console.log(`Found ${students.length} students to migrate`);
      let migratedStudents = 0;
      for (const student of students) {
        // Migrate all students, even with missing fields - use defaults
        try {
          const nombreCompleto = student.nombre_completo || student.nombres + ' ' + (student.apellidos || '');
          const grupoId = student.grupo_id || '00000000-0000-0000-0000-000000000000'; // Default UUID

          if (nombreCompleto.trim()) {
            await cockroachClient.query(
              'INSERT INTO estudiantes (id, grupo_id, nombre_completo, num_orden, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
              [student.id, grupoId, nombreCompleto.trim(), student.num_orden || 0, student.created_at, student.updated_at]
            );
            migratedStudents++;
          } else {
            console.warn(`Skipping student ${student.id} - no valid name`);
          }
        } catch (error) {
          console.error(`Error migrating student ${student.id}:`, error.message);
        }
      }
      console.log(`✅ Migrated ${migratedStudents} students`);
    }

    // Migrate assignments
    console.log('Migrating assignments...');
    const { data: assignments, error: assignmentsError } = await supabase
      .from('asignaciones')
      .select('*');

    if (assignmentsError) {
      console.error('Error fetching assignments:', assignmentsError);
    } else {
      for (const assignment of assignments) {
        await cockroachClient.query(
          'INSERT INTO asignaciones (id, user_id, curso_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
          [assignment.id, assignment.user_id, assignment.curso_id, assignment.created_at, assignment.updated_at]
        );
      }
      console.log(`✅ Migrated ${assignments.length} assignments`);
    }

    // Migrate units
    console.log('Migrating units...');
    const { data: units, error: unitsError } = await supabase
      .from('unidades')
      .select('*');

    if (unitsError) {
      console.error('Error fetching units:', unitsError);
    } else {
      for (const unit of units) {
        await cockroachClient.query(
          'INSERT INTO unidades (id, curso_id, nombre, periodo, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
          [unit.id, unit.curso_id, unit.nombre, unit.periodo, unit.created_at, unit.updated_at]
        );
      }
      console.log(`✅ Migrated ${units.length} units`);
    }

    // Migrate criteria
    console.log('Migrating criteria...');
    const { data: criteria, error: criteriaError } = await supabase
      .from('criterios')
      .select('*');

    if (criteriaError) {
      console.error('Error fetching criteria:', criteriaError);
    } else {
      for (const criterion of criteria) {
        await cockroachClient.query(
          'INSERT INTO criterios (id, unidad_id, nombre, orden, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
          [criterion.id, criterion.unidad_id, criterion.nombre, criterion.orden, criterion.created_at, criterion.updated_at]
        );
      }
      console.log(`✅ Migrated ${criteria.length} criteria`);
    }

    // Migrate grades
    console.log('Migrating grades...');
    const { data: grades, error: gradesError } = await supabase
      .from('calificaciones')
      .select('*');

    if (gradesError) {
      console.error('Error fetching grades:', gradesError);
    } else {
      console.log(`Found ${grades.length} grades to migrate`);
      let migratedGrades = 0;
      for (const grade of grades) {
        // Only migrate grades with valid required fields
        if (grade.estudiante_id && grade.unidad_id && grade.criterio_id) {
          try {
            await cockroachClient.query(
              'INSERT INTO calificaciones (id, estudiante_id, unidad_id, criterio_id, calificacion, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING',
              [grade.id, grade.estudiante_id, grade.unidad_id, grade.criterio_id, grade.calificacion, grade.created_at, grade.updated_at]
            );
            migratedGrades++;
          } catch (error) {
            console.error(`Error migrating grade ${grade.id}:`, error.message);
          }
        } else {
          console.warn(`Skipping grade ${grade.id} - missing required fields (estudiante_id: ${grade.estudiante_id}, unidad_id: ${grade.unidad_id}, criterio_id: ${grade.criterio_id})`);
        }
      }
      console.log(`✅ Migrated ${migratedGrades} grades`);
    }

    // Migrate comments
    console.log('Migrating comments...');
    const { data: comments, error: commentsError } = await supabase
      .from('comentarios')
      .select('*');

    if (commentsError) {
      console.error('Error fetching comments:', commentsError);
    } else {
      for (const comment of comments) {
        await cockroachClient.query(
          'INSERT INTO comentarios (id, curso_id, estudiante_id, periodo, texto, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING',
          [comment.id, comment.curso_id, comment.estudiante_id, comment.periodo, comment.texto, comment.created_at, comment.updated_at]
        );
      }
      console.log(`✅ Migrated ${comments.length} comments`);
    }

    // Migrate config (skip if there are null keys)
    console.log('Migrating config...');
    const { data: configs, error: configsError } = await supabase
      .from('config')
      .select('*');

    if (configsError) {
      console.error('Error fetching config:', configsError);
    } else {
      let migratedConfigs = 0;
      for (const config of configs) {
        if (config.key && config.value) { // Only migrate if key and value are not null
          try {
            await cockroachClient.query(
              'INSERT INTO config (id, key, value, created_at, updated_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (key) DO NOTHING',
              [config.id, config.key, config.value, config.created_at, config.updated_at]
            );
            migratedConfigs++;
          } catch (error) {
            console.warn(`Skipping config entry with key: ${config.key}, error: ${error.message}`);
          }
        }
      }
      console.log(`✅ Migrated ${migratedConfigs} config entries`);
    }

    // Migrate templates
    console.log('Migrating templates...');
    const { data: templates, error: templatesError } = await supabase
      .from('plantillas_criterios')
      .select('*');

    if (templatesError) {
      console.error('Error fetching templates:', templatesError);
    } else {
      for (const template of templates) {
        await cockroachClient.query(
          'INSERT INTO plantillas_criterios (id, nombre, created_at, updated_at) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
          [template.id, template.nombre, template.created_at, template.updated_at]
        );
      }
      console.log(`✅ Migrated ${templates.length} templates`);
    }

    // Migrate template details
    console.log('Migrating template details...');
    const { data: templateDetails, error: templateDetailsError } = await supabase
      .from('plantillas_criterios_detalle')
      .select('*');

    if (templateDetailsError) {
      console.error('Error fetching template details:', templateDetailsError);
    } else {
      for (const detail of templateDetails) {
        await cockroachClient.query(
          'INSERT INTO plantillas_criterios_detalle (id, plantilla_id, nombre, orden, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
          [detail.id, detail.plantilla_id, detail.nombre, detail.orden, detail.created_at, detail.updated_at]
        );
      }
      console.log(`✅ Migrated ${templateDetails.length} template details`);
    }

    // Migrate competency config
    console.log('Migrating competency config...');
    const { data: competencyConfigs, error: competencyConfigsError } = await supabase
      .from('competencia_config')
      .select('*');

    if (competencyConfigsError) {
      console.error('Error fetching competency config:', competencyConfigsError);
    } else {
      for (const config of competencyConfigs) {
        await cockroachClient.query(
          'INSERT INTO competencia_config (id, competencia_grupo, created_at, updated_at) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
          [config.id, config.competencia_grupo, config.created_at, config.updated_at]
        );
      }
      console.log(`✅ Migrated ${competencyConfigs.length} competency configs`);
    }

    // Migrate recovery competencies
    console.log('Migrating recovery competencies...');
    const { data: recoveries, error: recoveriesError } = await supabase
      .from('recuperaciones_competencias')
      .select('*');

    if (recoveriesError) {
      console.error('Error fetching recovery competencies:', recoveriesError);
    } else {
      for (const recovery of recoveries) {
        await cockroachClient.query(
          'INSERT INTO recuperaciones_competencias (id, curso_id, estudiante_id, calificacion, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
          [recovery.id, recovery.curso_id, recovery.estudiante_id, recovery.calificacion, recovery.created_at, recovery.updated_at]
        );
      }
      console.log(`✅ Migrated ${recoveries.length} recovery competencies`);
    }

    console.log('🎉 Data migration completed successfully!');

  } catch (error) {
    console.error('❌ Error during migration:', error);
  } finally {
    await cockroachClient.end();
    console.log('Database connections closed');
  }
}

migrateData();