package dev.resident2026.sheet

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.security.SecureRandom
import java.util.UUID

data class Attribute(val key: String, val name: String, val group: String)

val ATTRIBUTES = listOf(
    Attribute("knowledge", "Знания / Интеллект", "Ум"),
    Attribute("imagination", "Воображение", "Ум"),
    Attribute("will", "Сила воли", "Ум"),
    Attribute("strength", "Сила тела", "Тело"),
    Attribute("agility", "Ловкость", "Тело"),
    Attribute("endurance", "Выносливость", "Тело"),
    Attribute("manipulation", "Манипулирование", "Харизма"),
    Attribute("presence", "Внушительность", "Харизма"),
    Attribute("insight", "Понимание", "Харизма")
)
val GROUPS = listOf("Ум", "Тело", "Харизма")

val SKILL_EXAMPLES = listOf(
    "Стрельба", "Бдительность", "Топография", "Атлетика", "Уклонение", "Драка",
    "Взлом", "Красноречие", "Обман", "Запугивание", "Знания вирусологии",
    "Знания медицины", "Знания животных", "Хакер", "Акробатика", "Фехтование"
)

data class AbilityRow(val id: String = UUID.randomUUID().toString(), val name: String)
data class SkillRow(
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val level: Int = 1
)
data class ItemRow(
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val quantity: Int = 1,
    val cost: Int = 0
)
data class ConditionRow(
    val id: String = UUID.randomUUID().toString(),
    val title: String,
    val track: String = "physical",
    val below: Int = 3,
    val note: String = ""
)
data class Sheet(
    val name: String = "",
    val role: String = "Новобранец BSAA",
    val born: String = "",
    val birthplace: String = "",
    val inclination: String = "",
    val purpose: String = "",
    val story: String = "",
    val notes: String = "",
    val strongest: String = "Ум",
    val weakest: String = "Тело",
    val attrs: Map<String, Int> = ATTRIBUTES.associate { it.key to 1 },
    val skills: List<SkillRow> = emptyList(),
    val abilities: List<AbilityRow> = emptyList(),
    val items: List<ItemRow> = emptyList(),
    val physical: List<String> = emptyList(),
    val mental: List<String> = emptyList(),
    val conditions: List<ConditionRow> = emptyList(),
    val portraitPath: String = "",
    val budget: Int = 21
) {
    fun level(key: String) = (attrs[key] ?: 1).coerceIn(1, 5)
    fun maxHealth(track: String) = 5 + level(if (track == "physical") "endurance" else "will")
    fun healthLeft(track: String): Int = (maxHealth(track) - if (track == "physical") physical.size else mental.size).coerceAtLeast(0)
    fun pointsSpent(): Int = skills.sumOf { it.level } + items.sumOf { it.cost }
    fun groupBudget(group: String) = when (group) {
        strongest -> 5
        weakest -> 3
        else -> 4
    }
    fun groupCost(group: String) = ATTRIBUTES.filter { it.group == group }.sumOf { key ->
        val level = level(key.key)
        (level - 1) + if (level == 5) 1 else 0
    }
    fun canSetAttribute(key: String, level: Int): Boolean {
        if (level !in 1..5) return false
        val group = ATTRIBUTES.firstOrNull { it.key == key }?.group ?: return false
        val updated = copy(attrs = attrs + (key to level))
        return updated.groupCost(group) <= updated.groupBudget(group)
    }
    fun defense() = minOf(level("agility"), level("imagination"))
    fun valid(): Boolean = strongest != weakest && GROUPS.all { groupCost(it) <= groupBudget(it) }
}

data class DiceRoll(
    val pool: Int, val difficulty: Int, val dice: List<Int>,
    val bonus: Int, val successes: Int, val outcome: String
)

object ResidentDice {
    private val random = SecureRandom()
    fun roll(pool: Int, difficulty: Int): DiceRoll {
        val target = difficulty.coerceIn(1, 5)
        if (pool < 0) return DiceRoll(pool, target, emptyList(), 0, -1, "КРИТИЧЕСКИЙ ПРОВАЛ")
        var bonus = 0
        var successes = 0
        val dice = mutableListOf<Int>()
        for (i in 0 until pool.coerceAtMost(100)) {
            dice.add(random.nextInt(10) + 1)
        }
        var index = 0
        while (index < dice.size && dice.size < 500) {
            val die = dice[index]
            if (die == 1) successes--
            if (die >= 8) successes++
            if (die == 10) {
                bonus++
                dice.add(random.nextInt(10) + 1)
            }
            index++
        }
        // Последний куб тоже учитывается, если лимит безопасности прервал цепочку 10.
        if (index < dice.size) {
            for (i in index until dice.size) {
                if (dice[i] == 1) successes--
                if (dice[i] >= 8) successes++
            }
        }
        val outcome = when {
            successes < 0 -> "КРИТИЧЕСКИЙ ПРОВАЛ"
            successes >= target + 3 -> "КРИТИЧЕСКИЙ УСПЕХ"
            successes >= target -> "УСПЕХ"
            else -> "НЕУДАЧА"
        }
        return DiceRoll(pool, target, dice, bonus, successes, outcome)
    }
    fun initiative(agility: Int): Pair<Int,Int> {
        val die = random.nextInt(10) + 1
        return die to die + agility
    }
}

object SheetStorage {
    private const val PREFERENCES = "resident_2026_local_sheet_v1"
    private const val KEY = "sheet"

    fun load(context: Context): Sheet {
        val raw = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return Sheet()
        return runCatching { fromJson(JSONObject(raw)) }.getOrDefault(Sheet())
    }

    fun save(context: Context, sheet: Sheet) {
        context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).edit()
            .putString(KEY, toJson(sheet).toString()).apply()
    }

    fun toJson(s: Sheet) = JSONObject().apply {
        put("name", s.name)
        put("role", s.role)
        put("born", s.born)
        put("birthplace", s.birthplace)
        put("inclination", s.inclination)
        put("purpose", s.purpose)
        put("story", s.story)
        put("notes", s.notes)
        put("strongest", s.strongest)
        put("weakest", s.weakest)
        put("budget", s.budget)
        put("portraitPath", s.portraitPath)
        put("attrs", JSONObject(s.attrs))
        put("skills", JSONArray().apply {
            s.skills.forEach { put(JSONObject().apply {
                put("id", it.id); put("name", it.name); put("level", it.level)
            }) }
        })
        put("abilities", JSONArray().apply {
            s.abilities.forEach { put(JSONObject().apply { put("id", it.id); put("name", it.name) }) }
        })
        put("items", JSONArray().apply {
            s.items.forEach { put(JSONObject().apply {
                put("id", it.id); put("name", it.name); put("quantity", it.quantity); put("cost", it.cost)
            }) }
        })
        put("physical", JSONArray(s.physical))
        put("mental", JSONArray(s.mental))
        put("conditions", JSONArray().apply {
            s.conditions.forEach { put(JSONObject().apply {
                put("id", it.id); put("title", it.title); put("track", it.track)
                put("below", it.below); put("note", it.note)
            }) }
        })
    }

    private fun JSONArray.strings(): List<String> = (0 until length()).mapNotNull {
        optString(it).takeIf(String::isNotBlank)
    }

    fun fromJson(o: JSONObject): Sheet {
        val empty = Sheet()
        val map = o.optJSONObject("attrs") ?: JSONObject()
        val attrs = ATTRIBUTES.associate { it.key to map.optInt(it.key, 1).coerceIn(1, 5) }
        val skills = o.optJSONArray("skills") ?: JSONArray()
        val items = o.optJSONArray("items") ?: JSONArray()
        val abilities = o.optJSONArray("abilities") ?: JSONArray()
        val conditions = o.optJSONArray("conditions") ?: JSONArray()
        return Sheet(
            name = o.optString("name"), role = o.optString("role", empty.role),
            born = o.optString("born"), birthplace = o.optString("birthplace"),
            inclination = o.optString("inclination"), purpose = o.optString("purpose"),
            story = o.optString("story"), notes = o.optString("notes"),
            strongest = o.optString("strongest", empty.strongest).takeIf { it in GROUPS } ?: empty.strongest,
            weakest = o.optString("weakest", empty.weakest).takeIf { it in GROUPS } ?: empty.weakest,
            attrs = attrs,
            skills = (0 until skills.length()).mapNotNull { i ->
                skills.optJSONObject(i)?.let { SkillRow(
                    id = it.optString("id", UUID.randomUUID().toString()),
                    name = it.optString("name"), level = it.optInt("level", 1).coerceIn(1, 5)
                ) }
            },
            abilities = (0 until abilities.length()).mapNotNull { i ->
                abilities.optJSONObject(i)?.let { AbilityRow(
                    id = it.optString("id", UUID.randomUUID().toString()), name = it.optString("name")
                ) }
            },
            items = (0 until items.length()).mapNotNull { i ->
                items.optJSONObject(i)?.let { ItemRow(
                    id = it.optString("id", UUID.randomUUID().toString()),
                    name = it.optString("name"),
                    quantity = it.optInt("quantity", 1).coerceIn(0, 999),
                    cost = it.optInt("cost", 0).coerceIn(0, 21)
                ) }
            },
            physical = (o.optJSONArray("physical") ?: JSONArray()).strings().filter { it in listOf("blunt", "lethal") }.take(10),
            mental = (o.optJSONArray("mental") ?: JSONArray()).strings().filter { it in listOf("blunt", "lethal") }.take(10),
            conditions = (0 until conditions.length()).mapNotNull { i ->
                conditions.optJSONObject(i)?.let { ConditionRow(
                    id = it.optString("id", UUID.randomUUID().toString()),
                    title = it.optString("title"),
                    track = it.optString("track", "physical").takeIf { t -> t in listOf("physical", "mental") } ?: "physical",
                    below = it.optInt("below", 3).coerceIn(0, 10),
                    note = it.optString("note")
                ) }
            },
            portraitPath = o.optString("portraitPath"),
            budget = o.optInt("budget", 21).takeIf { it == 18 || it == 21 } ?: 21
        )
    }
}
